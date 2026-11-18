-- GAMVORAQ v6 · Migración aditiva. Ejecutar UNA vez, DESPUÉS de 001 y 002.
-- No borra tablas ni datos: UNIVERSE, LIVE PULSE y CHRONICLES siguen en la base aunque la app v6 ya no las muestre.
--
-- Qué agrega:
--   1. Idioma principal por cuenta y traducción automática (caché solo accesible desde el servidor).
--   2. Protección de menores: año de nacimiento PRIVADO y reglas para que adultos y menores no se escriban.
--   3. «Disponible para jugar».
--   4. Agenda de partidas con asistencia (RSVP).
--   5. Química de equipo (calificaciones positivas y privadas) y Pasaporte GG.
--   6. Límite de envíos por minuto (anti-spam) en el servidor.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;

-- ───────────────────────── 1. Perfil: idioma, traducción y etiquetas de juego ─────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS auto_translate boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS play_tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_language_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_language_check
  CHECK (language IN ('es','en','pt','fr','it','de','ja','ko','zh'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_play_tags_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_play_tags_check
  CHECK (play_tags <@ ARRAY['sin_microfono','solo_texto','paciencia','sin_presion','una_mano','lector_pantalla','daltonismo','principiante']::text[]
         AND cardinality(play_tags) <= 8);

-- ───────────────────────── 2. Protección de menores ─────────────────────────
-- El año de nacimiento vive en una tabla aparte que SOLO su dueño puede leer. Nadie más ve la edad de nadie.
CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  birth_year smallint NOT NULL CHECK (birth_year BETWEEN 1900 AND 2100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_private FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profile_private TO authenticated;
DROP POLICY IF EXISTS "private_self_read" ON public.profile_private;
DROP POLICY IF EXISTS "private_self_add" ON public.profile_private;
DROP POLICY IF EXISTS "private_self_edit" ON public.profile_private;
CREATE POLICY "private_self_read" ON public.profile_private FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "private_self_add" ON public.profile_private FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "private_self_edit" ON public.profile_private FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- Rango de edad conservador con solo el año: quien cumple 18 este año se trata como menor hasta el año siguiente.
CREATE OR REPLACE FUNCTION private.age_band(uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE
    WHEN p.birth_year IS NULL THEN 'unknown'
    WHEN extract(year FROM now())::int - p.birth_year >= 19 THEN 'adult'
    ELSE 'minor' END
  FROM (SELECT (SELECT birth_year FROM public.profile_private WHERE user_id = uid) AS birth_year) p;
$$;
-- ¿Pueden dos personas interactuar en privado? Menores solo con menores. Un perfil sin edad nunca puede escribir a un menor.
CREATE OR REPLACE FUNCTION private.same_age_band(a uuid, b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE
    WHEN private.age_band(a) = 'minor' OR private.age_band(b) = 'minor' THEN private.age_band(a) = private.age_band(b)
    ELSE true END;
$$;
-- Para la app: mi rango de edad y con cuáles de estos perfiles puedo interactuar en privado (sin revelar edades).
CREATE OR REPLACE FUNCTION public.my_age_band() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT private.age_band((SELECT auth.uid()));
$$;
CREATE OR REPLACE FUNCTION public.private_ok(ids uuid[]) RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(array_agg(x), '{}') FROM unnest(ids[1:500]) AS x WHERE private.same_age_band((SELECT auth.uid()), x);
$$;

-- Mensajes privados: además de no estar bloqueados, deben estar en el mismo rango de edad.
DROP POLICY IF EXISTS "conversations_create" ON public.conversations;
CREATE POLICY "conversations_create" ON public.conversations FOR INSERT TO authenticated WITH CHECK (
  (user_low = (SELECT auth.uid()) OR user_high = (SELECT auth.uid()))
  AND public.is_not_blocked(CASE WHEN user_low = (SELECT auth.uid()) THEN user_high ELSE user_low END)
  AND private.same_age_band(user_low, user_high));
DROP POLICY IF EXISTS "dms_send" ON public.direct_messages;
CREATE POLICY "dms_send" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = (SELECT auth.uid()) AND public.is_conversation_member(conversation_id)
  AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
              AND public.is_not_blocked(CASE WHEN c.user_low = (SELECT auth.uid()) THEN c.user_high ELSE c.user_low END)
              AND private.same_age_band(c.user_low, c.user_high)));

-- ───────────────────────── 3. Traducción automática ─────────────────────────
-- La caché NO tiene políticas para usuarios: solo la Edge Function «translate» (clave secreta) la lee y escribe,
-- después de comprobar con la sesión del usuario que puede leer el mensaje original.
CREATE TABLE IF NOT EXISTS public.message_translations (
  source text NOT NULL CHECK (source IN ('direct_messages','squad_messages','channel_messages','comments','posts')),
  message_id uuid NOT NULL,
  target_lang text NOT NULL CHECK (target_lang IN ('es','en','pt','fr','it','de','ja','ko','zh')),
  source_lang text,
  translated text NOT NULL,
  provider text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, message_id, target_lang)
);
CREATE TABLE IF NOT EXISTS public.translation_usage (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  chars integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.message_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_translations, public.translation_usage FROM anon, authenticated;
-- Suma de caracteres atómica para el límite diario (la llama la Edge Function con la clave secreta).
-- Un valor negativo devuelve caracteres reservados que al final no se tradujeron (nunca baja de 0).
CREATE OR REPLACE FUNCTION public.add_translation_usage(uid uuid, n integer) RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  INSERT INTO public.translation_usage(user_id, day, chars) VALUES (uid, current_date, greatest(n, 0))
  ON CONFLICT (user_id, day) DO UPDATE SET chars = greatest(public.translation_usage.chars + n, 0)
  RETURNING chars;
$$;
REVOKE ALL ON FUNCTION public.add_translation_usage(uuid, integer) FROM PUBLIC, anon, authenticated;
-- Solo el servidor (clave secreta = rol service_role) usa la caché y el contador.
GRANT SELECT, INSERT, UPDATE ON public.message_translations, public.translation_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.add_translation_usage(uuid, integer) TO service_role;

-- ───────────────────────── 4. «Disponible para jugar» ─────────────────────────
CREATE TABLE IF NOT EXISTS public.availability (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id bigint REFERENCES public.games(id) ON DELETE SET NULL,
  platform text NOT NULL DEFAULT 'Multiplataforma' CHECK (char_length(platform) <= 40),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 120),
  until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION private.clamp_availability() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF new.until <= now() THEN RAISE EXCEPTION 'La disponibilidad debe terminar en el futuro'; END IF;
  IF new.until > now() + interval '6 hours' THEN new.until := now() + interval '6 hours'; END IF;
  new.created_at := now();
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_clamp_availability ON public.availability;
CREATE TRIGGER trg_clamp_availability BEFORE INSERT OR UPDATE ON public.availability FOR EACH ROW EXECUTE FUNCTION private.clamp_availability();
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.availability FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability TO authenticated;
DROP POLICY IF EXISTS "availability_read" ON public.availability;
DROP POLICY IF EXISTS "availability_set" ON public.availability;
DROP POLICY IF EXISTS "availability_edit" ON public.availability;
DROP POLICY IF EXISTS "availability_clear" ON public.availability;
CREATE POLICY "availability_read" ON public.availability FOR SELECT TO authenticated USING (public.is_not_blocked(user_id));
CREATE POLICY "availability_set" ON public.availability FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "availability_edit" ON public.availability FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "availability_clear" ON public.availability FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- ───────────────────────── 5. Agenda de partidas ─────────────────────────
CREATE TABLE IF NOT EXISTS public.play_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE,
  game_id bigint REFERENCES public.games(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  starts_at timestamptz NOT NULL,
  duration_min smallint NOT NULL DEFAULT 60 CHECK (duration_min BETWEEN 15 AND 480),
  capacity smallint NOT NULL DEFAULT 5 CHECK (capacity BETWEEN 2 AND 20),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.session_rsvps (
  session_id uuid NOT NULL REFERENCES public.play_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'going' CHECK (status IN ('going','maybe','no')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_sessions_starts ON public.play_sessions(starts_at);
CREATE INDEX IF NOT EXISTS ix_sessions_squad ON public.play_sessions(squad_id);
CREATE INDEX IF NOT EXISTS ix_rsvps_user ON public.session_rsvps(user_id);

CREATE OR REPLACE FUNCTION private.can_see_session(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.play_sessions s WHERE s.id = sid AND (
    s.host_id = (SELECT auth.uid())
    OR (s.squad_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.squad_members m WHERE m.squad_id = s.squad_id AND m.user_id = (SELECT auth.uid())))
    OR (s.squad_id IS NULL AND public.is_not_blocked(s.host_id) AND private.same_age_band((SELECT auth.uid()), s.host_id))));
$$;
-- Solo se puede calificar o confirmar en partidas visibles; el cupo se valida con bloqueo de fila.
CREATE OR REPLACE FUNCTION private.check_rsvp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.play_sessions%ROWTYPE; taken int;
BEGIN
  SELECT * INTO s FROM public.play_sessions WHERE id = new.session_id FOR UPDATE;
  IF s.status <> 'scheduled' THEN RAISE EXCEPTION 'Esta partida fue cancelada'; END IF;
  IF s.starts_at + make_interval(mins => s.duration_min) < now() THEN RAISE EXCEPTION 'Esta partida ya terminó'; END IF;
  IF new.status = 'going' THEN
    SELECT count(*) INTO taken FROM public.session_rsvps r WHERE r.session_id = new.session_id AND r.status = 'going' AND r.user_id <> new.user_id;
    IF taken >= s.capacity THEN RAISE EXCEPTION 'La partida ya está llena'; END IF;
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_check_rsvp ON public.session_rsvps;
CREATE TRIGGER trg_check_rsvp BEFORE INSERT OR UPDATE ON public.session_rsvps FOR EACH ROW EXECUTE FUNCTION private.check_rsvp();
-- Quien organiza queda apuntado automáticamente y el squad recibe un aviso.
CREATE OR REPLACE FUNCTION private.on_session_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.session_rsvps(session_id, user_id, status) VALUES (new.id, new.host_id, 'going') ON CONFLICT DO NOTHING;
  IF new.squad_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, actor_id, kind, body, ref_id)
    SELECT m.user_id, new.host_id, 'session', 'Nueva partida en tu squad: ' || new.title, new.id
    FROM public.squad_members m WHERE m.squad_id = new.squad_id AND m.user_id <> new.host_id;
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_session_created ON public.play_sessions;
CREATE TRIGGER trg_session_created AFTER INSERT ON public.play_sessions FOR EACH ROW EXECUTE FUNCTION private.on_session_created();
CREATE OR REPLACE FUNCTION private.protect_session() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF new.host_id IS DISTINCT FROM old.host_id OR new.squad_id IS DISTINCT FROM old.squad_id THEN
    RAISE EXCEPTION 'No se puede cambiar quién organiza ni el squad de una partida';
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_protect_session ON public.play_sessions;
CREATE TRIGGER trg_protect_session BEFORE UPDATE ON public.play_sessions FOR EACH ROW EXECUTE FUNCTION private.protect_session();

ALTER TABLE public.play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_rsvps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.play_sessions, public.session_rsvps FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.play_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_rsvps TO authenticated;
DROP POLICY IF EXISTS "sessions_read" ON public.play_sessions;
DROP POLICY IF EXISTS "sessions_add" ON public.play_sessions;
DROP POLICY IF EXISTS "sessions_edit" ON public.play_sessions;
CREATE POLICY "sessions_read" ON public.play_sessions FOR SELECT TO authenticated USING (private.can_see_session(id));
CREATE POLICY "sessions_add" ON public.play_sessions FOR INSERT TO authenticated WITH CHECK (
  host_id = (SELECT auth.uid()) AND status = 'scheduled'
  AND starts_at > now() - interval '10 minutes' AND starts_at < now() + interval '60 days'
  AND (squad_id IS NULL OR private.is_squad_member(squad_id)));
CREATE POLICY "sessions_edit" ON public.play_sessions FOR UPDATE TO authenticated USING (host_id = (SELECT auth.uid())) WITH CHECK (host_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "rsvps_read" ON public.session_rsvps;
DROP POLICY IF EXISTS "rsvps_add" ON public.session_rsvps;
DROP POLICY IF EXISTS "rsvps_edit" ON public.session_rsvps;
DROP POLICY IF EXISTS "rsvps_remove" ON public.session_rsvps;
CREATE POLICY "rsvps_read" ON public.session_rsvps FOR SELECT TO authenticated USING (private.can_see_session(session_id));
CREATE POLICY "rsvps_add" ON public.session_rsvps FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND private.can_see_session(session_id));
CREATE POLICY "rsvps_edit" ON public.session_rsvps FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()) AND private.can_see_session(session_id));
CREATE POLICY "rsvps_remove" ON public.session_rsvps FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- ───────────────────────── 6. Química de equipo y Pasaporte GG ─────────────────────────
-- Solo etiquetas POSITIVAS. Nadie ve quién le calificó: la lectura directa es solo de lo que tú diste;
-- el resto llega agregado por funciones.
CREATE TABLE IF NOT EXISTS public.chemistry_ratings (
  session_id uuid NOT NULL REFERENCES public.play_sessions(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ratee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tags text[] NOT NULL CHECK (cardinality(tags) BETWEEN 1 AND 5
    AND tags <@ ARRAY['entendimos','comunicacion','divertido','amable','puntual']::text[]),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, rater_id, ratee_id),
  CHECK (rater_id <> ratee_id)
);
CREATE INDEX IF NOT EXISTS ix_chemistry_ratee ON public.chemistry_ratings(ratee_id);
CREATE OR REPLACE FUNCTION private.can_rate(sid uuid, rater uuid, ratee uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.play_sessions s WHERE s.id = sid AND s.status = 'scheduled'
                   AND s.starts_at < now() AND s.starts_at > now() - interval '14 days')
     AND EXISTS (SELECT 1 FROM public.session_rsvps r WHERE r.session_id = sid AND r.user_id = rater AND r.status = 'going')
     AND EXISTS (SELECT 1 FROM public.session_rsvps r WHERE r.session_id = sid AND r.user_id = ratee AND r.status = 'going');
$$;
ALTER TABLE public.chemistry_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chemistry_ratings FROM anon, authenticated;
GRANT SELECT, INSERT ON public.chemistry_ratings TO authenticated;
DROP POLICY IF EXISTS "chemistry_read_own" ON public.chemistry_ratings;
DROP POLICY IF EXISTS "chemistry_rate" ON public.chemistry_ratings;
CREATE POLICY "chemistry_read_own" ON public.chemistry_ratings FOR SELECT TO authenticated USING (rater_id = (SELECT auth.uid()));
CREATE POLICY "chemistry_rate" ON public.chemistry_ratings FOR INSERT TO authenticated WITH CHECK (
  rater_id = (SELECT auth.uid()) AND private.can_rate(session_id, rater_id, ratee_id));

-- Pasaporte GG de cualquier persona: solo números agregados.
CREATE OR REPLACE FUNCTION public.gg_passport(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'sessions', (SELECT count(*) FROM public.session_rsvps r JOIN public.play_sessions s ON s.id = r.session_id
                 WHERE r.user_id = target AND r.status = 'going' AND s.status = 'scheduled' AND s.starts_at < now()),
    'raters', (SELECT count(DISTINCT rater_id) FROM public.chemistry_ratings WHERE ratee_id = target),
    'tags', coalesce((SELECT jsonb_object_agg(tag, n) FROM (
              SELECT tag, count(*) AS n FROM public.chemistry_ratings c, unnest(c.tags) AS tag
              WHERE c.ratee_id = target GROUP BY tag) t), '{}'::jsonb));
$$;
-- Química conmigo: puntos por par en ambas direcciones (sin revelar quién dio qué etiqueta).
CREATE OR REPLACE FUNCTION public.my_chemistry() RETURNS TABLE(other_id uuid, points integer, sessions integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT other_id, sum(cardinality(tags))::int, count(DISTINCT session_id)::int FROM (
    SELECT ratee_id AS other_id, tags, session_id FROM public.chemistry_ratings WHERE rater_id = (SELECT auth.uid())
    UNION ALL
    SELECT rater_id, tags, session_id FROM public.chemistry_ratings WHERE ratee_id = (SELECT auth.uid())
  ) x GROUP BY other_id;
$$;

-- ───────────────────────── 7. Límite de envíos (anti-spam en el servidor) ─────────────────────────
CREATE OR REPLACE FUNCTION private.rate_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE author uuid := (to_jsonb(new) ->> TG_ARGV[0])::uuid; n int;
BEGIN
  EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1 AND created_at > now() - interval ''1 minute''',
                 TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_ARGV[0]) INTO n USING author;
  IF n >= TG_ARGV[1]::int THEN RAISE EXCEPTION 'rate_limit: demasiados envíos seguidos' USING ERRCODE = 'P0001'; END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_rate_dm ON public.direct_messages;
DROP TRIGGER IF EXISTS trg_rate_squad ON public.squad_messages;
DROP TRIGGER IF EXISTS trg_rate_channel ON public.channel_messages;
DROP TRIGGER IF EXISTS trg_rate_comment ON public.comments;
DROP TRIGGER IF EXISTS trg_rate_post ON public.posts;
CREATE TRIGGER trg_rate_dm BEFORE INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION private.rate_limit('sender_id', '20');
CREATE TRIGGER trg_rate_squad BEFORE INSERT ON public.squad_messages FOR EACH ROW EXECUTE FUNCTION private.rate_limit('sender_id', '20');
CREATE TRIGGER trg_rate_channel BEFORE INSERT ON public.channel_messages FOR EACH ROW EXECUTE FUNCTION private.rate_limit('author_id', '10');
CREATE TRIGGER trg_rate_comment BEFORE INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION private.rate_limit('author_id', '10');
CREATE TRIGGER trg_rate_post BEFORE INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION private.rate_limit('author_id', '5');
CREATE INDEX IF NOT EXISTS ix_dm_sender_time ON public.direct_messages(sender_id, created_at);
CREATE INDEX IF NOT EXISTS ix_squad_msg_sender_time ON public.squad_messages(sender_id, created_at);
CREATE INDEX IF NOT EXISTS ix_comments_author_time ON public.comments(author_id, created_at);

-- ───────────────────────── Permisos de funciones y tiempo real ─────────────────────────
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION public.my_age_band(), public.private_ok(uuid[]), public.gg_passport(uuid), public.my_chemistry() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_age_band(), public.private_ok(uuid[]), public.gg_passport(uuid), public.my_chemistry() TO authenticated;

-- Una tabla a la vez: si alguna ya estaba publicada, las demás se agregan igual.
-- Incluye las de la 001 por si aquel script se cortó antes de llegar al final (ver GUIA_ACTUALIZACION_V6.md).
DO $$DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['direct_messages','squad_messages','channel_messages','notifications','availability','play_sessions','session_rsvps'] LOOP
      BEGIN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object THEN NULL; END;
    END LOOP;
  END IF;
END $$;
-- La 001 original tenía un error de comillas en este título que cortaba el script; se agrega aquí por si faltaba.
INSERT INTO public.games(name, genre, platform) VALUES ('Don''t Starve Together', 'Supervivencia', 'Multiplataforma') ON CONFLICT (name) DO NOTHING;
COMMIT;
