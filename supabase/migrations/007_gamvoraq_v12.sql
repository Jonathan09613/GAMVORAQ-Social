-- GAMVORAQ v12 · Migración aditiva. Ejecutar DESPUÉS de 001-006. Se puede volver a ejecutar sin errores.
--
-- Qué corrige o agrega:
--   0. Permisos: vuelve a dar acceso a las funciones internas que usan las reglas de seguridad.
--      (Era la causa de «No tienes permiso» al crear squads, retos o agendar partidas.)
--   1. Retos: cualquier integrante de una comunidad puede crear retos en ella (el staff modera).
--   2. Partidas: el dueño decide si los integrantes del squad pueden agendar (por defecto, sí).
--   3. Mensajes: borrar chats «para mí», borrar mensajes y diagnóstico de por qué no se puede escribir.
--   4. Moderación de la app: reportes de cualquier cosa, suspensiones, palabras prohibidas,
--      freno anti-spam, silencio automático tras varios reportes y registro de acciones.
--   5. Squads: música compartida (canción + artista) y encuestas.
--   6. Comunidades: el staff puede sacar integrantes; el dueño nombra moderadores.
--   7. NOVA/VORA: su apariencia se guarda en tu perfil para verla igual en todos tus dispositivos.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;

-- ═════════════════════════ 0. PERMISOS ═════════════════════════
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT EXECUTE ON FUNCTIONS TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_staff(uuid), public.is_squad_member(uuid), public.is_conversation_member(uuid), public.is_not_blocked(uuid) TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.play_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squads, public.squad_members, public.squad_messages, public.quests, public.quest_entries,
  public.conversations, public.direct_messages, public.follows, public.blocks, public.posts, public.comments, public.communities,
  public.community_members, public.reports TO authenticated;

-- ═════════════════════════ 1. RETOS ═════════════════════════
DROP POLICY IF EXISTS "quests_create" ON public.quests;
CREATE POLICY "quests_create" ON public.quests FOR INSERT TO authenticated WITH CHECK (
  creator_id = (SELECT auth.uid())
  AND (community_id IS NULL OR EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = quests.community_id AND m.user_id = (SELECT auth.uid()))));

-- ═════════════════════════ 2. PARTIDAS DEL SQUAD ═════════════════════════
ALTER TABLE public.squads ADD COLUMN IF NOT EXISTS members_can_schedule boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION private.can_schedule(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT private.is_squad_staff(sid)
      OR (public.is_squad_member(sid) AND coalesce((SELECT members_can_schedule FROM public.squads WHERE id = sid), true));
$$;
DROP POLICY IF EXISTS "sessions_add" ON public.play_sessions;
CREATE POLICY "sessions_add" ON public.play_sessions FOR INSERT TO authenticated WITH CHECK (
  host_id = (SELECT auth.uid()) AND status = 'scheduled'
  AND starts_at > now() - interval '10 minutes' AND starts_at < now() + interval '60 days'
  AND (squad_id IS NULL OR private.can_schedule(squad_id))
  AND (squad_id IS NOT NULL OR NOT private.has_open_strike((SELECT auth.uid()))));
DROP POLICY IF EXISTS "sessions_delete" ON public.play_sessions;
CREATE POLICY "sessions_delete" ON public.play_sessions FOR DELETE TO authenticated USING (
  host_id = (SELECT auth.uid()) OR (squad_id IS NOT NULL AND private.is_squad_staff(squad_id)));

-- ═════════════════════════ 3. MENSAJES ═════════════════════════
-- «Borrar chat»: lo oculta solo para ti. Si te vuelven a escribir, reaparece solo con lo nuevo.
CREATE TABLE IF NOT EXISTS public.conversation_hides (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);
ALTER TABLE public.conversation_hides ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_hides TO authenticated;
DROP POLICY IF EXISTS "hides_own" ON public.conversation_hides;
CREATE POLICY "hides_own" ON public.conversation_hides FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_conversation_member(conversation_id));

-- ═════════════════════════ 4. MODERACIÓN ═════════════════════════
-- 4.1 Suspensiones (temporales o largas). Solo se crean con funciones de moderación.
CREATE TABLE IF NOT EXISTS public.suspensions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  until timestamptz NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suspensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suspensions FROM anon, authenticated;
GRANT SELECT ON public.suspensions TO authenticated;
-- ¿Por qué no puedo escribirle a esta persona? (sin revelar su edad)
CREATE OR REPLACE FUNCTION public.dm_check(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN 'login'
    WHEN target = (SELECT auth.uid()) THEN 'self'
    WHEN EXISTS (SELECT 1 FROM public.blocks WHERE (blocker_id = (SELECT auth.uid()) AND blocked_id = target) OR (blocker_id = target AND blocked_id = (SELECT auth.uid()))) THEN 'blocked'
    WHEN private.age_band((SELECT auth.uid())) = 'unknown' THEN 'my_age'
    WHEN private.age_band(target) = 'unknown' THEN 'their_age'
    WHEN NOT private.same_age_band((SELECT auth.uid()), target) THEN 'age_band'
    WHEN EXISTS (SELECT 1 FROM public.suspensions s WHERE s.user_id = (SELECT auth.uid()) AND s.until > now()) THEN 'suspended'
    ELSE 'ok' END;
$$;

-- 4.2 Palabras prohibidas (las administra el panel de moderación).
CREATE TABLE IF NOT EXISTS public.blocked_words (
  word text PRIMARY KEY CHECK (char_length(word) BETWEEN 2 AND 60),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.blocked_words ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocked_words FROM anon, authenticated;
GRANT SELECT ON public.blocked_words TO authenticated;
INSERT INTO public.blocked_words(word) VALUES
  ('matate'), ('suicidate'), ('muerete'), ('kys'), ('kill yourself'), ('go die'),
  ('vai se matar'), ('se mata logo'), ('se donde vives'), ('i know where you live'), ('sei onde voce mora')
ON CONFLICT DO NOTHING;
-- 4.3 Registro de acciones de moderación.
CREATE TABLE IF NOT EXISTS public.mod_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_kind text,
  target_id text,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mod_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mod_log FROM anon, authenticated;
GRANT SELECT ON public.mod_log TO authenticated;

CREATE OR REPLACE FUNCTION private.is_app_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = (SELECT auth.uid()));
$$;
CREATE OR REPLACE FUNCTION private.is_suspended(uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.suspensions WHERE user_id = uid AND until > now());
$$;
DROP POLICY IF EXISTS "suspensions_read" ON public.suspensions;
CREATE POLICY "suspensions_read" ON public.suspensions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR private.is_app_admin());
DROP POLICY IF EXISTS "blocked_words_read" ON public.blocked_words;
CREATE POLICY "blocked_words_read" ON public.blocked_words FOR SELECT TO authenticated USING (private.is_app_admin());
DROP POLICY IF EXISTS "mod_log_read" ON public.mod_log;
CREATE POLICY "mod_log_read" ON public.mod_log FOR SELECT TO authenticated USING (private.is_app_admin());

-- 4.4 Filtro de contenido: suspensión, palabras prohibidas y freno anti-spam (límite por minuto según la tabla).
CREATE OR REPLACE FUNCTION private.fold(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT regexp_replace(translate(lower(coalesce(t, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç0134@$', 'aaaaaeeeeiiiiooooouuuuncoieaas'), '\s+', ' ', 'g');
$$;
CREATE OR REPLACE FUNCTION private.guard_content() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  row_ jsonb := to_jsonb(new);
  uid uuid := (row_ ->> tg_argv[0])::uuid;
  body text := private.fold(concat_ws(' ', row_ ->> tg_argv[1], row_ ->> 'title', row_ ->> 'artist', row_ ->> 'question'));
  hit text; n int;
BEGIN
  IF uid IS NULL OR current_user IN ('postgres', 'service_role', 'supabase_admin') AND (SELECT auth.uid()) IS NULL THEN RETURN new; END IF;
  IF private.is_suspended(uid) THEN
    RAISE EXCEPTION 'Tu cuenta está suspendida temporalmente por la moderación. Podrás volver a publicar cuando termine.' USING ERRCODE = 'P0001';
  END IF;
  SELECT w.word INTO hit FROM public.blocked_words w
   WHERE (' ' || regexp_replace(body, '[^a-z0-9 ]', ' ', 'g') || ' ') LIKE '% ' || private.fold(w.word) || ' %' LIMIT 1;
  IF hit IS NOT NULL THEN
    RAISE EXCEPTION 'Tu mensaje contiene una expresión que no se permite en GAMVORAQ (acoso o amenaza). Reescríbelo, por favor.' USING ERRCODE = 'P0001';
  END IF;
  EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1 AND created_at > now() - interval ''1 minute''', tg_table_schema, tg_table_name, tg_argv[0]) INTO n USING uid;
  IF n >= coalesce(tg_argv[2], '25')::int THEN RAISE EXCEPTION 'Vas muy rápido. Espera un minuto antes de seguir enviando.' USING ERRCODE = 'P0001'; END IF;
  RETURN new;
END $$;
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT * FROM (VALUES ('posts', 'author_id', 'body', '6'), ('comments', 'author_id', 'body', '15'), ('direct_messages', 'sender_id', 'body', '30'),
    ('squad_messages', 'sender_id', 'body', '30'), ('channel_messages', 'author_id', 'body', '15'), ('squads', 'owner_id', 'name', '5'),
    ('communities', 'owner_id', 'name', '3'), ('quests', 'creator_id', 'title', '4')) AS v(tbl, ucol, bcol, lim) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guard_content ON public.%I', t.tbl);
    EXECUTE format('CREATE TRIGGER trg_guard_content BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_content(%L, %L, %L)', t.tbl, t.ucol, t.bcol, t.lim);
  END LOOP;
END $$;

-- 4.5 Reportes de cualquier cosa (publicación, comentario, mensaje, persona, squad o comunidad).
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS target_kind text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS snapshot text NOT NULL DEFAULT '';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_check;
DO $$ BEGIN
  ALTER TABLE public.reports ADD CONSTRAINT reports_target_chk CHECK (post_id IS NOT NULL OR reported_user_id IS NOT NULL OR target_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.reports ADD CONSTRAINT reports_kind_chk CHECK (target_kind IS NULL OR target_kind IN ('post', 'comment', 'dm', 'squad_message', 'user', 'squad', 'community', 'track'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE public.reports SET target_kind = 'post', target_id = post_id WHERE target_kind IS NULL AND post_id IS NOT NULL;
UPDATE public.reports SET target_kind = 'user', target_id = reported_user_id WHERE target_kind IS NULL AND reported_user_id IS NOT NULL;

DROP POLICY IF EXISTS "reports_add" ON public.reports;
CREATE POLICY "reports_add" ON public.reports FOR INSERT TO authenticated WITH CHECK (
  reporter_id = (SELECT auth.uid()) AND status = 'open' AND resolved_by IS NULL AND action IS NULL
  AND coalesce(reported_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> (SELECT auth.uid()));
DROP POLICY IF EXISTS "reports_read" ON public.reports;
CREATE POLICY "reports_read" ON public.reports FOR SELECT TO authenticated USING (
  reporter_id = (SELECT auth.uid()) OR private.is_app_admin() OR (community_id IS NOT NULL AND public.is_community_staff(community_id)));
DROP POLICY IF EXISTS "reports_review" ON public.reports;
CREATE POLICY "reports_review" ON public.reports FOR UPDATE TO authenticated
  USING (private.is_app_admin() OR (community_id IS NOT NULL AND public.is_community_staff(community_id)))
  WITH CHECK (private.is_app_admin() OR (community_id IS NOT NULL AND public.is_community_staff(community_id)));

-- Al reportar se guarda una copia del texto (la moderación lo ve aunque sea privado o se borre después),
-- se avisa a los administradores y, con 3 reportes de personas distintas en 24 h, se silencia 24 h de forma automática.
CREATE OR REPLACE FUNCTION private.before_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE txt text; who uuid;
BEGIN
  IF new.target_kind IS NULL THEN new.target_kind := CASE WHEN new.post_id IS NOT NULL THEN 'post' ELSE 'user' END; END IF;
  IF new.target_id IS NULL THEN new.target_id := coalesce(new.post_id, new.reported_user_id); END IF;
  CASE new.target_kind
    WHEN 'post' THEN SELECT body, author_id INTO txt, who FROM public.posts WHERE id = new.target_id;
    WHEN 'comment' THEN SELECT body, author_id INTO txt, who FROM public.comments WHERE id = new.target_id;
    WHEN 'dm' THEN
      SELECT m.body, m.sender_id INTO txt, who FROM public.direct_messages m WHERE m.id = new.target_id AND public.is_conversation_member(m.conversation_id);
      IF txt IS NULL THEN RAISE EXCEPTION 'Solo puedes reportar mensajes de tus chats'; END IF;
    WHEN 'squad_message' THEN
      SELECT m.body, m.sender_id INTO txt, who FROM public.squad_messages m WHERE m.id = new.target_id AND public.is_squad_member(m.squad_id);
      IF txt IS NULL THEN RAISE EXCEPTION 'Solo puedes reportar mensajes de tus squads'; END IF;
    WHEN 'squad' THEN SELECT name || ' — ' || coalesce(description, ''), owner_id INTO txt, who FROM public.squads WHERE id = new.target_id;
    WHEN 'community' THEN SELECT name || ' — ' || coalesce(description, ''), owner_id INTO txt, who FROM public.communities WHERE id = new.target_id;
    WHEN 'user' THEN SELECT display_name || ' (@' || username || ') ' || coalesce(bio, ''), id INTO txt, who FROM public.profiles WHERE id = new.target_id;
    ELSE NULL;
  END CASE;
  new.snapshot := left(coalesce(txt, new.snapshot, ''), 2000);
  new.reported_user_id := coalesce(new.reported_user_id, who);
  IF new.reported_user_id = new.reporter_id THEN RAISE EXCEPTION 'No puedes reportarte a ti mismo'; END IF;
  IF EXISTS (SELECT 1 FROM public.reports r WHERE r.reporter_id = new.reporter_id AND r.target_id = new.target_id AND r.status = 'open') THEN
    RAISE EXCEPTION 'Ya reportaste esto. La moderación lo está revisando.';
  END IF;
  IF (SELECT count(*) FROM public.reports r WHERE r.reporter_id = new.reporter_id AND r.created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'Enviaste muchos reportes en poco tiempo. Espera un poco.';
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_before_report ON public.reports;
CREATE TRIGGER trg_before_report BEFORE INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION private.before_report();
CREATE OR REPLACE FUNCTION private.after_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.notifications(user_id, actor_id, kind, body, ref_id)
  SELECT a.user_id, NULL, 'moderation', 'Nuevo reporte (' || new.reason || ') para revisar', new.id FROM public.app_admins a WHERE a.user_id <> new.reporter_id;
  IF new.reported_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = new.reported_user_id) THEN
    SELECT count(DISTINCT reporter_id) INTO n FROM public.reports WHERE reported_user_id = new.reported_user_id AND status = 'open' AND created_at > now() - interval '24 hours';
    IF n >= 3 AND NOT private.is_suspended(new.reported_user_id) THEN
      INSERT INTO public.suspensions(user_id, until, reason) VALUES (new.reported_user_id, now() + interval '24 hours', 'Silencio automático: varios reportes en 24 horas')
      ON CONFLICT (user_id) DO UPDATE SET until = excluded.until, reason = excluded.reason, created_by = NULL, created_at = now();
      INSERT INTO public.notifications(user_id, kind, body) VALUES (new.reported_user_id, 'moderation', 'Recibiste varios reportes. Tu cuenta queda en pausa 24 horas mientras la moderación revisa.');
      INSERT INTO public.mod_log(actor_id, action, target_kind, target_id, detail) VALUES (NULL, 'auto_mute', 'user', new.reported_user_id::text, n || ' reportes en 24 h');
    END IF;
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_after_report ON public.reports;
CREATE TRIGGER trg_after_report AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION private.after_report();

-- 4.6 Acciones de administración (solo administradores de la app).
CREATE OR REPLACE FUNCTION public.admin_delete(kind text, target uuid, why text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_ uuid;
BEGIN
  IF NOT private.is_app_admin() THEN RAISE EXCEPTION 'Solo la administración puede hacer esto'; END IF;
  CASE kind
    WHEN 'post' THEN DELETE FROM public.posts WHERE id = target RETURNING author_id INTO owner_;
    WHEN 'comment' THEN DELETE FROM public.comments WHERE id = target RETURNING author_id INTO owner_;
    WHEN 'dm' THEN DELETE FROM public.direct_messages WHERE id = target RETURNING sender_id INTO owner_;
    WHEN 'squad_message' THEN DELETE FROM public.squad_messages WHERE id = target RETURNING sender_id INTO owner_;
    WHEN 'squad' THEN DELETE FROM public.squads WHERE id = target RETURNING owner_id INTO owner_;
    WHEN 'community' THEN DELETE FROM public.communities WHERE id = target RETURNING owner_id INTO owner_;
    WHEN 'track' THEN DELETE FROM public.squad_tracks WHERE id = target RETURNING user_id INTO owner_;
    ELSE RAISE EXCEPTION 'Tipo no válido';
  END CASE;
  UPDATE public.reports SET status = 'reviewed', action = 'deleted', resolved_by = (SELECT auth.uid()), resolved_at = now() WHERE target_id = target AND status = 'open';
  INSERT INTO public.mod_log(actor_id, action, target_kind, target_id, detail) VALUES ((SELECT auth.uid()), 'delete', kind, target::text, coalesce(why, ''));
  IF owner_ IS NOT NULL AND owner_ <> (SELECT auth.uid()) THEN
    INSERT INTO public.notifications(user_id, kind, body) VALUES (owner_, 'moderation', 'La moderación eliminó contenido tuyo por no respetar las normas de la comunidad.' || CASE WHEN coalesce(why, '') <> '' THEN ' Motivo: ' || why ELSE '' END);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.admin_suspend(target uuid, hours integer, why text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT private.is_app_admin() THEN RAISE EXCEPTION 'Solo la administración puede hacer esto'; END IF;
  IF target = (SELECT auth.uid()) THEN RAISE EXCEPTION 'No puedes suspenderte a ti mismo'; END IF;
  IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = target) THEN RAISE EXCEPTION 'No puedes suspender a otra persona administradora'; END IF;
  IF hours IS NULL OR hours < 1 OR hours > 87600 THEN RAISE EXCEPTION 'Duración no válida'; END IF;
  INSERT INTO public.suspensions(user_id, until, reason, created_by) VALUES (target, now() + make_interval(hours => hours), coalesce(why, ''), (SELECT auth.uid()))
  ON CONFLICT (user_id) DO UPDATE SET until = excluded.until, reason = excluded.reason, created_by = excluded.created_by, created_at = now();
  UPDATE public.reports SET status = 'reviewed', action = 'suspended', resolved_by = (SELECT auth.uid()), resolved_at = now() WHERE reported_user_id = target AND status = 'open';
  INSERT INTO public.mod_log(actor_id, action, target_kind, target_id, detail) VALUES ((SELECT auth.uid()), 'suspend', 'user', target::text, hours || ' h · ' || coalesce(why, ''));
  INSERT INTO public.notifications(user_id, kind, body) VALUES (target, 'moderation', 'Tu cuenta fue suspendida temporalmente por la moderación.' || CASE WHEN coalesce(why, '') <> '' THEN ' Motivo: ' || why ELSE '' END);
END $$;
CREATE OR REPLACE FUNCTION public.admin_unsuspend(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT private.is_app_admin() THEN RAISE EXCEPTION 'Solo la administración puede hacer esto'; END IF;
  DELETE FROM public.suspensions WHERE user_id = target;
  INSERT INTO public.mod_log(actor_id, action, target_kind, target_id) VALUES ((SELECT auth.uid()), 'unsuspend', 'user', target::text);
  INSERT INTO public.notifications(user_id, kind, body) VALUES (target, 'moderation', 'Tu suspensión terminó. ¡Bienvenido de vuelta!');
END $$;
CREATE OR REPLACE FUNCTION public.admin_resolve(report uuid, verdict text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT private.is_app_admin() THEN RAISE EXCEPTION 'Solo la administración puede hacer esto'; END IF;
  IF verdict NOT IN ('reviewed', 'dismissed') THEN RAISE EXCEPTION 'Decisión no válida'; END IF;
  UPDATE public.reports SET status = verdict, action = coalesce(action, CASE verdict WHEN 'reviewed' THEN 'warned' ELSE 'dismissed' END), resolved_by = (SELECT auth.uid()), resolved_at = now() WHERE id = report;
  INSERT INTO public.mod_log(actor_id, action, target_kind, target_id) VALUES ((SELECT auth.uid()), verdict, 'report', report::text);
END $$;
CREATE OR REPLACE FUNCTION public.admin_word(term text, adding boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w text := private.fold(trim(term));
BEGIN
  IF NOT private.is_app_admin() THEN RAISE EXCEPTION 'Solo la administración puede hacer esto'; END IF;
  IF char_length(w) < 2 THEN RAISE EXCEPTION 'Escribe una palabra o frase'; END IF;
  IF adding THEN INSERT INTO public.blocked_words(word) VALUES (w) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.blocked_words b WHERE b.word = w; END IF;
  INSERT INTO public.mod_log(actor_id, action, target_kind, detail) VALUES ((SELECT auth.uid()), CASE WHEN adding THEN 'word_add' ELSE 'word_remove' END, 'word', w);
END $$;
-- Resumen para el panel: cuentas, actividad y reportes abiertos.
CREATE OR REPLACE FUNCTION public.admin_stats() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT private.is_app_admin() THEN RAISE EXCEPTION 'Solo la administración puede hacer esto'; END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'new_week', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'posts_day', (SELECT count(*) FROM public.posts WHERE created_at > now() - interval '1 day'),
    'messages_day', (SELECT count(*) FROM public.direct_messages WHERE created_at > now() - interval '1 day') + (SELECT count(*) FROM public.squad_messages WHERE created_at > now() - interval '1 day'),
    'open_reports', (SELECT count(*) FROM public.reports WHERE status = 'open'),
    'suspended', (SELECT count(*) FROM public.suspensions WHERE until > now()),
    'squads', (SELECT count(*) FROM public.squads), 'communities', (SELECT count(*) FROM public.communities));
END $$;

-- ═════════════════════════ 5. SQUADS: MÚSICA Y ENCUESTAS ═════════════════════════
CREATE TABLE IF NOT EXISTS public.squad_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  artist text NOT NULL CHECK (char_length(artist) BETWEEN 1 AND 120),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 200),
  artwork_url text CHECK (artwork_url IS NULL OR artwork_url ~ '^https://'),
  preview_url text CHECK (preview_url IS NULL OR preview_url ~ '^https://'),
  link_url text CHECK (link_url IS NULL OR link_url ~ '^https://'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_tracks_squad ON public.squad_tracks(squad_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.track_likes (
  track_id uuid NOT NULL REFERENCES public.squad_tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.squad_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (char_length(question) BETWEEN 3 AND 160),
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 6),
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.squad_poll_votes (
  poll_id uuid NOT NULL REFERENCES public.squad_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  choice integer NOT NULL CHECK (choice BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
ALTER TABLE public.squad_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_poll_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_tracks, public.track_likes, public.squad_polls, public.squad_poll_votes FROM anon;
GRANT SELECT, INSERT, DELETE ON public.squad_tracks, public.track_likes, public.squad_polls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_poll_votes TO authenticated;
DROP POLICY IF EXISTS "tracks_read" ON public.squad_tracks;
DROP POLICY IF EXISTS "tracks_add" ON public.squad_tracks;
DROP POLICY IF EXISTS "tracks_remove" ON public.squad_tracks;
CREATE POLICY "tracks_read" ON public.squad_tracks FOR SELECT TO authenticated USING (public.is_squad_member(squad_id));
CREATE POLICY "tracks_add" ON public.squad_tracks FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_squad_member(squad_id));
CREATE POLICY "tracks_remove" ON public.squad_tracks FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()) OR private.is_squad_staff(squad_id));
DROP POLICY IF EXISTS "track_likes_read" ON public.track_likes;
DROP POLICY IF EXISTS "track_likes_add" ON public.track_likes;
DROP POLICY IF EXISTS "track_likes_remove" ON public.track_likes;
CREATE POLICY "track_likes_read" ON public.track_likes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.squad_tracks t WHERE t.id = track_id AND public.is_squad_member(t.squad_id)));
CREATE POLICY "track_likes_add" ON public.track_likes FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.squad_tracks t WHERE t.id = track_id AND public.is_squad_member(t.squad_id)));
CREATE POLICY "track_likes_remove" ON public.track_likes FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "polls_read" ON public.squad_polls;
DROP POLICY IF EXISTS "polls_add" ON public.squad_polls;
DROP POLICY IF EXISTS "polls_remove" ON public.squad_polls;
CREATE POLICY "polls_read" ON public.squad_polls FOR SELECT TO authenticated USING (public.is_squad_member(squad_id));
CREATE POLICY "polls_add" ON public.squad_polls FOR INSERT TO authenticated WITH CHECK (creator_id = (SELECT auth.uid()) AND public.is_squad_member(squad_id) AND (closes_at IS NULL OR closes_at > now()));
CREATE POLICY "polls_remove" ON public.squad_polls FOR DELETE TO authenticated USING (creator_id = (SELECT auth.uid()) OR private.is_squad_staff(squad_id));
DROP POLICY IF EXISTS "votes_read" ON public.squad_poll_votes;
DROP POLICY IF EXISTS "votes_add" ON public.squad_poll_votes;
DROP POLICY IF EXISTS "votes_change" ON public.squad_poll_votes;
DROP POLICY IF EXISTS "votes_remove" ON public.squad_poll_votes;
CREATE OR REPLACE FUNCTION private.poll_open(pid uuid, choice integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.squad_polls p WHERE p.id = pid AND public.is_squad_member(p.squad_id)
    AND (p.closes_at IS NULL OR p.closes_at > now()) AND choice < jsonb_array_length(p.options));
$$;
CREATE POLICY "votes_read" ON public.squad_poll_votes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.squad_polls p WHERE p.id = poll_id AND public.is_squad_member(p.squad_id)));
CREATE POLICY "votes_add" ON public.squad_poll_votes FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND private.poll_open(poll_id, choice));
CREATE POLICY "votes_change" ON public.squad_poll_votes FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()) AND private.poll_open(poll_id, choice));
CREATE POLICY "votes_remove" ON public.squad_poll_votes FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT * FROM (VALUES ('squad_tracks', 'user_id', 'note', '8'), ('squad_polls', 'creator_id', 'question', '4')) AS v(tbl, ucol, bcol, lim) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guard_content ON public.%I', t.tbl);
    EXECUTE format('CREATE TRIGGER trg_guard_content BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_content(%L, %L, %L)', t.tbl, t.ucol, t.bcol, t.lim);
  END LOOP;
END $$;
-- Aviso al squad cuando alguien comparte una canción o abre una encuesta.
CREATE OR REPLACE FUNCTION private.on_squad_extra() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who text; sname text; uid uuid := coalesce((to_jsonb(new) ->> 'user_id'), (to_jsonb(new) ->> 'creator_id'))::uuid; msg text; m record;
BEGIN
  SELECT display_name INTO who FROM public.profiles WHERE id = uid;
  SELECT name INTO sname FROM public.squads WHERE id = new.squad_id;
  msg := CASE tg_table_name WHEN 'squad_tracks' THEN coalesce(sname, 'Squad') || ' · ' || coalesce(who, 'Alguien') || ' compartió 🎵 ' || (to_jsonb(new) ->> 'title') || ' — ' || (to_jsonb(new) ->> 'artist')
    ELSE coalesce(sname, 'Squad') || ' · ' || coalesce(who, 'Alguien') || ' abrió una encuesta: ' || (to_jsonb(new) ->> 'question') END;
  FOR m IN SELECT user_id FROM public.squad_members WHERE squad_id = new.squad_id AND user_id <> uid AND NOT muted LOOP
    PERFORM private.upsert_chat_notice(m.user_id, uid, 'squad_message', left(msg, 180), new.squad_id);
  END LOOP;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_squad_extra ON public.squad_tracks;
CREATE TRIGGER trg_squad_extra AFTER INSERT ON public.squad_tracks FOR EACH ROW EXECUTE FUNCTION private.on_squad_extra();
DROP TRIGGER IF EXISTS trg_squad_extra ON public.squad_polls;
CREATE TRIGGER trg_squad_extra AFTER INSERT ON public.squad_polls FOR EACH ROW EXECUTE FUNCTION private.on_squad_extra();

-- ═════════════════════════ 6. COMUNIDADES ═════════════════════════
DROP POLICY IF EXISTS "members_kick" ON public.community_members;
CREATE POLICY "members_kick" ON public.community_members FOR DELETE TO authenticated USING (
  role = 'member' AND public.is_community_staff(community_id));
CREATE OR REPLACE FUNCTION public.set_community_role(cid uuid, target uuid, new_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.communities WHERE id = cid AND owner_id = (SELECT auth.uid())) THEN RAISE EXCEPTION 'Solo quien creó la comunidad nombra moderadores'; END IF;
  IF new_role NOT IN ('moderator', 'member') OR target = (SELECT auth.uid()) THEN RAISE EXCEPTION 'Cambio no válido'; END IF;
  UPDATE public.community_members SET role = new_role WHERE community_id = cid AND user_id = target AND role <> 'owner';
END $$;

-- ═════════════════════════ 7. APARIENCIA DEL COMPAÑERO ═════════════════════════
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS companion jsonb;
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_companion_chk CHECK (companion IS NULL OR (jsonb_typeof(companion) = 'object' AND length(companion::text) < 600));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═════════════════════════ 8. DIAGNÓSTICO ═════════════════════════
-- Lo usa la app para explicar con claridad qué falta (no revela datos de otras personas).
CREATE OR REPLACE FUNCTION public.gvq_health() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'version', 12,
    'age', private.age_band((SELECT auth.uid())),
    'admin', private.is_app_admin(),
    'suspended_until', (SELECT until FROM public.suspensions WHERE user_id = (SELECT auth.uid()) AND until > now()),
    'suspend_reason', (SELECT reason FROM public.suspensions WHERE user_id = (SELECT auth.uid()) AND until > now()),
    'grants', has_function_privilege('authenticated', 'private.is_squad_staff(uuid)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'private.can_interact(uuid,uuid)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'private.can_schedule(uuid)', 'EXECUTE'),
    'buckets', (SELECT count(*) FROM storage.buckets WHERE id IN ('gamvoraq', 'gamvoraq-memories')));
$$;

-- Funciones públicas: solo para cuentas con sesión.
REVOKE ALL ON FUNCTION public.dm_check(uuid), public.admin_delete(text, uuid, text), public.admin_suspend(uuid, integer, text), public.admin_unsuspend(uuid),
  public.admin_resolve(uuid, text), public.admin_word(text, boolean), public.admin_stats(), public.set_community_role(uuid, uuid, text), public.gvq_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dm_check(uuid), public.admin_delete(text, uuid, text), public.admin_suspend(uuid, integer, text), public.admin_unsuspend(uuid),
  public.admin_resolve(uuid, text), public.admin_word(text, boolean), public.admin_stats(), public.set_community_role(uuid, uuid, text), public.gvq_health() TO authenticated;
-- Las funciones internas nuevas también (las reglas de seguridad las llaman con la sesión del usuario).
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- Tiempo real.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_tracks; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_polls; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_poll_votes; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reports; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

COMMIT;
