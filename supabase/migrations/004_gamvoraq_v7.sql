-- GAMVORAQ v7 · Migración aditiva. Ejecutar UNA vez, DESPUÉS de 001, 002 y 003. Se puede volver a ejecutar sin errores.
--
-- Qué agrega:
--   1. Insignias especiales (no solo de retos): Mentor GG, Segunda oportunidad cumplida.
--   2. Segunda oportunidad: aviso privado y camino para recuperar la confianza en vez de solo castigar.
--   3. Modo «primer día»: veteranos que se ofrecen como guías y principiantes que piden ayuda.
--   4. Sala tranquila: disponibilidad en modo silencioso y saludos sin texto.
--   5. Ligas locales por escuela, universidad, ciudad o comunidad.
--   6. Modo familia: un adulto acompaña la actividad de un menor que lo acepta (sin leer mensajes).
--   7. Notificaciones push (suscripciones + aviso al servidor con pg_net).
--   8. Visibilidad opcional en Discord y contador de uso de funciones (IA, Steam).
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;

-- ───────────────────────── 1. Insignias especiales ─────────────────────────
ALTER TABLE public.badges ALTER COLUMN quest_id DROP NOT NULL;
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'quest';
CREATE UNIQUE INDEX IF NOT EXISTS ux_badges_special ON public.badges(user_id, name) WHERE quest_id IS NULL;
CREATE OR REPLACE FUNCTION private.award(uid uuid, badge text, k text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  INSERT INTO public.badges(user_id, quest_id, name, kind) VALUES (uid, NULL, badge, k) ON CONFLICT DO NOTHING;
$$;

-- ───────────────────────── 2. Segunda oportunidad ─────────────────────────
CREATE TABLE IF NOT EXISTS public.conduct_strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_id uuid UNIQUE REFERENCES public.reports(id) ON DELETE SET NULL,
  community_id uuid REFERENCES public.communities(id) ON DELETE SET NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_strikes_user ON public.conduct_strikes(user_id);
ALTER TABLE public.conduct_strikes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conduct_strikes FROM anon, authenticated;
GRANT SELECT ON public.conduct_strikes TO authenticated;
DROP POLICY IF EXISTS "strikes_read" ON public.conduct_strikes;
CREATE POLICY "strikes_read" ON public.conduct_strikes FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR (community_id IS NOT NULL AND public.is_community_staff(community_id)));

-- Cuando la moderación marca un reporte como «revisado» (válido), la persona recibe un aviso privado.
CREATE OR REPLACE FUNCTION private.on_report_reviewed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF new.status = 'reviewed' AND old.status IS DISTINCT FROM 'reviewed' AND new.reported_user_id IS NOT NULL THEN
    INSERT INTO public.conduct_strikes(user_id, report_id, community_id, reason)
    VALUES (new.reported_user_id, new.id, new.community_id, new.reason) ON CONFLICT (report_id) DO NOTHING;
    INSERT INTO public.notifications(user_id, kind, body, ref_id)
    VALUES (new.reported_user_id, 'conduct', 'La moderación revisó un reporte sobre ti. Tienes una segunda oportunidad: entra para verla.', new.id);
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_report_reviewed ON public.reports;
CREATE TRIGGER trg_report_reviewed AFTER UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION private.on_report_reviewed();

CREATE OR REPLACE FUNCTION private.has_open_strike(uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.conduct_strikes WHERE user_id = uid AND resolved_at IS NULL AND acknowledged_at IS NULL);
$$;
-- La persona lee lo ocurrido y se compromete con el código. Solo puede marcar sus propios avisos.
CREATE OR REPLACE FUNCTION public.acknowledge_strike(sid uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  UPDATE public.conduct_strikes SET acknowledged_at = coalesce(acknowledged_at, now())
  WHERE id = sid AND user_id = (SELECT auth.uid());
$$;
-- Estado del camino de vuelta. Se cumple cuando, tras comprometerse, 2 personas distintas te dan «amable» o «buena comunicación».
CREATE OR REPLACE FUNCTION public.second_chance() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid := (SELECT auth.uid()); s record; n int; out jsonb := '[]'::jsonb;
BEGIN
  FOR s IN SELECT * FROM public.conduct_strikes WHERE user_id = me AND resolved_at IS NULL ORDER BY created_at LOOP
    n := 0;
    IF s.acknowledged_at IS NOT NULL THEN
      SELECT count(DISTINCT rater_id) INTO n FROM public.chemistry_ratings
      WHERE ratee_id = me AND created_at > s.acknowledged_at AND tags && ARRAY['amable','comunicacion']::text[];
      IF n >= 2 THEN
        UPDATE public.conduct_strikes SET resolved_at = now() WHERE id = s.id;
        PERFORM private.award(me, 'Segunda oportunidad cumplida', 'conduct');
        CONTINUE;
      END IF;
    END IF;
    out := out || jsonb_build_object('id', s.id, 'reason', s.reason, 'created_at', s.created_at, 'acknowledged', s.acknowledged_at IS NOT NULL, 'progress', n, 'needed', 2);
  END LOOP;
  RETURN out;
END $$;
-- Mientras haya un aviso sin leer, no se pueden crear partidas abiertas al público (las del squad sí).
DROP POLICY IF EXISTS "sessions_add" ON public.play_sessions;
CREATE POLICY "sessions_add" ON public.play_sessions FOR INSERT TO authenticated WITH CHECK (
  host_id = (SELECT auth.uid()) AND status = 'scheduled'
  AND starts_at > now() - interval '10 minutes' AND starts_at < now() + interval '60 days'
  AND (squad_id IS NULL OR private.is_squad_member(squad_id))
  AND (squad_id IS NOT NULL OR NOT private.has_open_strike((SELECT auth.uid()))));

-- ───────────────────────── 3. Modo «primer día»: guías ─────────────────────────
CREATE TABLE IF NOT EXISTS public.guide_offers (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id bigint NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);
CREATE TABLE IF NOT EXISTS public.guide_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id bigint NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','done')),
  helpful boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (guide_id <> learner_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_guide_open ON public.guide_requests(guide_id, learner_id, game_id) WHERE status IN ('pending','accepted');
ALTER TABLE public.guide_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guide_offers, public.guide_requests FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_offers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.guide_requests TO authenticated;
DROP POLICY IF EXISTS "guide_offers_read" ON public.guide_offers;
DROP POLICY IF EXISTS "guide_offers_add" ON public.guide_offers;
DROP POLICY IF EXISTS "guide_offers_edit" ON public.guide_offers;
DROP POLICY IF EXISTS "guide_offers_remove" ON public.guide_offers;
CREATE POLICY "guide_offers_read" ON public.guide_offers FOR SELECT TO authenticated USING (public.is_not_blocked(user_id));
-- Solo puedes ser guía de un juego que está en tu biblioteca.
CREATE POLICY "guide_offers_add" ON public.guide_offers FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.user_games g WHERE g.user_id = (SELECT auth.uid()) AND g.game_id = guide_offers.game_id));
CREATE POLICY "guide_offers_edit" ON public.guide_offers FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "guide_offers_remove" ON public.guide_offers FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "guide_requests_read" ON public.guide_requests;
DROP POLICY IF EXISTS "guide_requests_add" ON public.guide_requests;
DROP POLICY IF EXISTS "guide_requests_edit" ON public.guide_requests;
CREATE POLICY "guide_requests_read" ON public.guide_requests FOR SELECT TO authenticated USING (
  guide_id = (SELECT auth.uid()) OR learner_id = (SELECT auth.uid()));
-- Pedir ayuda: la oferta debe existir, sin bloqueos y en el mismo rango de edad (después hablan en privado).
CREATE POLICY "guide_requests_add" ON public.guide_requests FOR INSERT TO authenticated WITH CHECK (
  learner_id = (SELECT auth.uid()) AND status = 'pending' AND helpful IS NULL
  AND EXISTS (SELECT 1 FROM public.guide_offers o WHERE o.user_id = guide_id AND o.game_id = guide_requests.game_id)
  AND public.is_not_blocked(guide_id) AND private.same_age_band(guide_id, learner_id));
CREATE POLICY "guide_requests_edit" ON public.guide_requests FOR UPDATE TO authenticated USING (
  guide_id = (SELECT auth.uid()) OR learner_id = (SELECT auth.uid())) WITH CHECK (guide_id = (SELECT auth.uid()) OR learner_id = (SELECT auth.uid()));
-- Quién cambia qué: la guía acepta o rechaza; quien aprende cierra y dice si le ayudó.
CREATE OR REPLACE FUNCTION private.guard_guide_request() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE me uuid := (SELECT auth.uid());
BEGIN
  IF new.guide_id IS DISTINCT FROM old.guide_id OR new.learner_id IS DISTINCT FROM old.learner_id OR new.game_id IS DISTINCT FROM old.game_id OR new.message IS DISTINCT FROM old.message THEN
    RAISE EXCEPTION 'No se puede cambiar la solicitud';
  END IF;
  IF me IS NOT NULL AND me = old.guide_id AND me <> old.learner_id THEN
    IF NOT (old.status = 'pending' AND new.status IN ('accepted','declined')) OR new.helpful IS DISTINCT FROM old.helpful THEN
      RAISE EXCEPTION 'La guía solo puede aceptar o rechazar una solicitud pendiente';
    END IF;
  ELSIF me IS NOT NULL AND me = old.learner_id THEN
    IF NOT (old.status IN ('pending','accepted') AND new.status = 'done') THEN
      RAISE EXCEPTION 'Quien aprende solo puede cerrar la solicitud';
    END IF;
    IF old.status = 'pending' AND new.helpful IS NOT NULL THEN RAISE EXCEPTION 'Solo puedes valorar una ayuda aceptada'; END IF;
  END IF;
  new.updated_at := now();
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_guard_guide ON public.guide_requests;
CREATE TRIGGER trg_guard_guide BEFORE UPDATE ON public.guide_requests FOR EACH ROW EXECUTE FUNCTION private.guard_guide_request();
CREATE OR REPLACE FUNCTION private.on_guide_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g text := (SELECT name FROM public.games WHERE id = new.game_id); helped int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, actor_id, kind, body, ref_id) VALUES (new.guide_id, new.learner_id, 'guide', 'Alguien que empieza en ' || coalesce(g, 'un juego') || ' te pidió ser su guía', new.id);
  ELSIF new.status = 'accepted' AND old.status = 'pending' THEN
    INSERT INTO public.notifications(user_id, actor_id, kind, body, ref_id) VALUES (new.learner_id, new.guide_id, 'guide', 'Tu guía de ' || coalesce(g, 'juego') || ' aceptó ayudarte. ¡Escríbele!', new.id);
  ELSIF new.helpful IS TRUE AND old.helpful IS DISTINCT FROM true THEN
    INSERT INTO public.notifications(user_id, actor_id, kind, body, ref_id) VALUES (new.guide_id, new.learner_id, 'guide', 'Tu ayuda en ' || coalesce(g, 'un juego') || ' sirvió. ¡Gracias por guiar!', new.id);
    SELECT count(*) INTO helped FROM public.guide_requests WHERE guide_id = new.guide_id AND helpful IS TRUE;
    IF helped >= 3 THEN PERFORM private.award(new.guide_id, 'Mentor GG', 'guide'); END IF;
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_guide_request ON public.guide_requests;
CREATE TRIGGER trg_guide_request AFTER INSERT OR UPDATE ON public.guide_requests FOR EACH ROW EXECUTE FUNCTION private.on_guide_request();

-- ───────────────────────── 4. Sala tranquila ─────────────────────────
ALTER TABLE public.availability ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'normal';
ALTER TABLE public.availability DROP CONSTRAINT IF EXISTS availability_mode_check;
ALTER TABLE public.availability ADD CONSTRAINT availability_mode_check CHECK (mode IN ('normal','silencioso'));
-- Saludo sin texto: compañía sin presión. Uno por pareja cada 30 minutos.
CREATE TABLE IF NOT EXISTS public.waves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_id <> to_id)
);
CREATE INDEX IF NOT EXISTS ix_waves_pair ON public.waves(from_id, to_id, created_at);
ALTER TABLE public.waves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waves FROM anon;
GRANT SELECT, INSERT ON public.waves TO authenticated;
DROP POLICY IF EXISTS "waves_read" ON public.waves;
DROP POLICY IF EXISTS "waves_send" ON public.waves;
CREATE POLICY "waves_read" ON public.waves FOR SELECT TO authenticated USING (from_id = (SELECT auth.uid()) OR to_id = (SELECT auth.uid()));
CREATE POLICY "waves_send" ON public.waves FOR INSERT TO authenticated WITH CHECK (
  from_id = (SELECT auth.uid()) AND public.is_not_blocked(to_id)
  AND EXISTS (SELECT 1 FROM public.availability a WHERE a.user_id = to_id AND a.mode = 'silencioso' AND a.until > now()));
CREATE OR REPLACE FUNCTION private.on_wave() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.waves w WHERE w.from_id = new.from_id AND w.to_id = new.to_id AND w.id <> new.id AND w.created_at > now() - interval '30 minutes') THEN
    RAISE EXCEPTION 'Ya saludaste a esta persona hace poco';
  END IF;
  INSERT INTO public.notifications(user_id, actor_id, kind, body, ref_id)
  VALUES (new.to_id, new.from_id, 'wave', coalesce((SELECT display_name FROM public.profiles WHERE id = new.from_id), 'Alguien') || ' te saludó desde la sala tranquila 👋', new.id);
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_wave ON public.waves;
CREATE TRIGGER trg_wave AFTER INSERT ON public.waves FOR EACH ROW EXECUTE FUNCTION private.on_wave();

-- ───────────────────────── 5. Ligas locales ─────────────────────────
CREATE TABLE IF NOT EXISTS public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 80),
  scope text NOT NULL DEFAULT 'comunidad' CHECK (scope IN ('escuela','universidad','ciudad','comunidad')),
  place text NOT NULL DEFAULT '' CHECK (char_length(place) <= 80),
  game_id bigint REFERENCES public.games(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 600),
  status text NOT NULL DEFAULT 'inscripciones' CHECK (status IN ('inscripciones','en_curso','terminada')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.league_teams (
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  registered_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, squad_id)
);
CREATE TABLE IF NOT EXISTS public.league_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  round smallint NOT NULL DEFAULT 1 CHECK (round BETWEEN 1 AND 60),
  home_squad uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  away_squad uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  scheduled_at timestamptz,
  home_score smallint CHECK (home_score BETWEEN 0 AND 999),
  away_score smallint CHECK (away_score BETWEEN 0 AND 999),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','played')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (home_squad <> away_squad),
  CHECK (status = 'scheduled' OR (home_score IS NOT NULL AND away_score IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_matches_league ON public.league_matches(league_id);
CREATE OR REPLACE FUNCTION private.is_league_owner(lid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.leagues WHERE id = lid AND owner_id = (SELECT auth.uid()));
$$;
CREATE OR REPLACE FUNCTION private.is_squad_owner(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = sid AND user_id = (SELECT auth.uid()) AND role = 'owner');
$$;
CREATE OR REPLACE FUNCTION private.check_match() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.league_teams WHERE league_id = new.league_id AND squad_id = new.home_squad)
     OR NOT EXISTS (SELECT 1 FROM public.league_teams WHERE league_id = new.league_id AND squad_id = new.away_squad) THEN
    RAISE EXCEPTION 'Ambos squads deben estar inscritos en la liga';
  END IF;
  IF TG_OP = 'UPDATE' AND (new.league_id <> old.league_id) THEN RAISE EXCEPTION 'No se puede mover un partido de liga'; END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_check_match ON public.league_matches;
CREATE TRIGGER trg_check_match BEFORE INSERT OR UPDATE ON public.league_matches FOR EACH ROW EXECUTE FUNCTION private.check_match();
-- Avisar a los squads cuando se registra un resultado.
CREATE OR REPLACE FUNCTION private.on_match_played() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF new.status = 'played' AND old.status IS DISTINCT FROM 'played' THEN
    INSERT INTO public.notifications(user_id, kind, body, ref_id)
    SELECT DISTINCT m.user_id, 'league',
      'Resultado en ' || (SELECT name FROM public.leagues WHERE id = new.league_id) || ': ' ||
      (SELECT name FROM public.squads WHERE id = new.home_squad) || ' ' || new.home_score || ' - ' || new.away_score || ' ' || (SELECT name FROM public.squads WHERE id = new.away_squad),
      new.league_id
    FROM public.squad_members m WHERE m.squad_id IN (new.home_squad, new.away_squad);
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_match_played ON public.league_matches;
CREATE TRIGGER trg_match_played AFTER UPDATE ON public.league_matches FOR EACH ROW EXECUTE FUNCTION private.on_match_played();
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leagues, public.league_teams, public.league_matches FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leagues, public.league_teams, public.league_matches TO authenticated;
DROP POLICY IF EXISTS "leagues_read" ON public.leagues;
DROP POLICY IF EXISTS "leagues_add" ON public.leagues;
DROP POLICY IF EXISTS "leagues_edit" ON public.leagues;
DROP POLICY IF EXISTS "leagues_remove" ON public.leagues;
CREATE POLICY "leagues_read" ON public.leagues FOR SELECT TO authenticated USING (true);
CREATE POLICY "leagues_add" ON public.leagues FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()) AND status = 'inscripciones');
CREATE POLICY "leagues_edit" ON public.leagues FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "leagues_remove" ON public.leagues FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "league_teams_read" ON public.league_teams;
DROP POLICY IF EXISTS "league_teams_add" ON public.league_teams;
DROP POLICY IF EXISTS "league_teams_remove" ON public.league_teams;
CREATE POLICY "league_teams_read" ON public.league_teams FOR SELECT TO authenticated USING (true);
-- Solo quien creó el squad lo inscribe, y solo mientras la liga acepta inscripciones.
CREATE POLICY "league_teams_add" ON public.league_teams FOR INSERT TO authenticated WITH CHECK (
  registered_by = (SELECT auth.uid()) AND private.is_squad_owner(squad_id)
  AND EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.status = 'inscripciones'));
CREATE POLICY "league_teams_remove" ON public.league_teams FOR DELETE TO authenticated USING (
  (private.is_squad_owner(squad_id) OR private.is_league_owner(league_id))
  AND EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.status = 'inscripciones'));
DROP POLICY IF EXISTS "league_matches_read" ON public.league_matches;
DROP POLICY IF EXISTS "league_matches_add" ON public.league_matches;
DROP POLICY IF EXISTS "league_matches_edit" ON public.league_matches;
DROP POLICY IF EXISTS "league_matches_remove" ON public.league_matches;
CREATE POLICY "league_matches_read" ON public.league_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "league_matches_add" ON public.league_matches FOR INSERT TO authenticated WITH CHECK (private.is_league_owner(league_id));
CREATE POLICY "league_matches_edit" ON public.league_matches FOR UPDATE TO authenticated USING (private.is_league_owner(league_id)) WITH CHECK (private.is_league_owner(league_id));
CREATE POLICY "league_matches_remove" ON public.league_matches FOR DELETE TO authenticated USING (private.is_league_owner(league_id));

-- ───────────────────────── 6. Modo familia ─────────────────────────
CREATE TABLE IF NOT EXISTS public.family_links (
  guardian_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  minor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guardian_id, minor_id),
  CHECK (guardian_id <> minor_id)
);
ALTER TABLE public.family_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_links FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_links TO authenticated;
DROP POLICY IF EXISTS "family_read" ON public.family_links;
DROP POLICY IF EXISTS "family_request" ON public.family_links;
DROP POLICY IF EXISTS "family_accept" ON public.family_links;
DROP POLICY IF EXISTS "family_remove" ON public.family_links;
CREATE POLICY "family_read" ON public.family_links FOR SELECT TO authenticated USING (guardian_id = (SELECT auth.uid()) OR minor_id = (SELECT auth.uid()));
-- Solo un adulto puede pedir acompañar a un menor; el menor decide si acepta.
CREATE POLICY "family_request" ON public.family_links FOR INSERT TO authenticated WITH CHECK (
  guardian_id = (SELECT auth.uid()) AND status = 'pending'
  AND private.age_band(guardian_id) = 'adult' AND private.age_band(minor_id) = 'minor');
CREATE POLICY "family_accept" ON public.family_links FOR UPDATE TO authenticated USING (minor_id = (SELECT auth.uid())) WITH CHECK (minor_id = (SELECT auth.uid()) AND status = 'accepted');
CREATE POLICY "family_remove" ON public.family_links FOR DELETE TO authenticated USING (guardian_id = (SELECT auth.uid()) OR minor_id = (SELECT auth.uid()));
CREATE OR REPLACE FUNCTION private.on_family_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE gname text; mname text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT display_name INTO mname FROM public.profiles WHERE id = old.minor_id;
    IF old.status = 'accepted' THEN
      INSERT INTO public.notifications(user_id, kind, body) VALUES (old.guardian_id, 'family', 'Terminó el acompañamiento familiar con ' || coalesce(mname, 'tu familiar'));
      INSERT INTO public.notifications(user_id, kind, body) VALUES (old.minor_id, 'family', 'Terminó el acompañamiento familiar de tu cuenta');
    END IF;
    RETURN old;
  END IF;
  SELECT display_name INTO gname FROM public.profiles WHERE id = new.guardian_id;
  SELECT display_name INTO mname FROM public.profiles WHERE id = new.minor_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, actor_id, kind, body) VALUES (new.minor_id, new.guardian_id, 'family', coalesce(gname, 'Un adulto') || ' quiere acompañar tu cuenta en modo familia. Puedes aceptar o rechazar en Ajustes.');
  ELSIF new.status = 'accepted' AND old.status = 'pending' THEN
    INSERT INTO public.notifications(user_id, actor_id, kind, body) VALUES (new.guardian_id, new.minor_id, 'family', coalesce(mname, 'Tu familiar') || ' aceptó el modo familia');
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_family_change ON public.family_links;
CREATE TRIGGER trg_family_change AFTER INSERT OR UPDATE OR DELETE ON public.family_links FOR EACH ROW EXECUTE FUNCTION private.on_family_change();
-- Resumen para el adulto: actividad y seguridad, NUNCA el contenido de los mensajes.
CREATE OR REPLACE FUNCTION public.family_overview(minor uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.family_links WHERE guardian_id = (SELECT auth.uid()) AND minor_id = minor AND status = 'accepted') THEN
    RAISE EXCEPTION 'No tienes un acompañamiento familiar aceptado con esta cuenta' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'squads', coalesce((SELECT jsonb_agg(s.name ORDER BY s.name) FROM public.squad_members m JOIN public.squads s ON s.id = m.squad_id WHERE m.user_id = minor), '[]'),
    'sessions', coalesce((SELECT jsonb_agg(jsonb_build_object('title', s.title, 'starts_at', s.starts_at, 'duration_min', s.duration_min) ORDER BY s.starts_at)
                FROM public.session_rsvps r JOIN public.play_sessions s ON s.id = r.session_id
                WHERE r.user_id = minor AND r.status = 'going' AND s.status = 'scheduled' AND s.starts_at > now() - interval '1 day'), '[]'),
    'chats_with', coalesce((SELECT jsonb_agg(DISTINCT p.display_name) FROM public.conversations c
                  JOIN public.profiles p ON p.id = CASE WHEN c.user_low = minor THEN c.user_high ELSE c.user_low END
                  WHERE (c.user_low = minor OR c.user_high = minor)
                    AND EXISTS (SELECT 1 FROM public.direct_messages d WHERE d.conversation_id = c.id AND d.created_at > now() - interval '30 days')), '[]'),
    'messages_week', (SELECT count(*) FROM public.direct_messages d WHERE d.sender_id = minor AND d.created_at > now() - interval '7 days')
                   + (SELECT count(*) FROM public.squad_messages d WHERE d.sender_id = minor AND d.created_at > now() - interval '7 days'),
    'last_active', greatest(
      (SELECT max(created_at) FROM public.direct_messages WHERE sender_id = minor),
      (SELECT max(created_at) FROM public.squad_messages WHERE sender_id = minor),
      (SELECT max(created_at) FROM public.posts WHERE author_id = minor)),
    'reports_about', (SELECT count(*) FROM public.reports WHERE reported_user_id = minor AND created_at > now() - interval '30 days'),
    'blocked', (SELECT count(*) FROM public.blocks WHERE blocker_id = minor),
    'available_now', EXISTS (SELECT 1 FROM public.availability WHERE user_id = minor AND until > now()));
END $$;
-- Para encontrar a un menor por su usuario sin exponer edades: solo devuelve el id si puede vincularse.
CREATE OR REPLACE FUNCTION public.family_lookup(uname text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p.id FROM public.profiles p
  WHERE p.username = lower(trim(uname)) AND private.age_band((SELECT auth.uid())) = 'adult' AND private.age_band(p.id) = 'minor';
$$;

-- ───────────────────────── 7. Notificaciones push ─────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%' AND char_length(endpoint) <= 1000),
  p256dh text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth text NOT NULL CHECK (char_length(auth) <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, DELETE ON public.push_subscriptions TO service_role;
DROP POLICY IF EXISTS "push_own" ON public.push_subscriptions;
CREATE POLICY "push_own" ON public.push_subscriptions FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
-- Configuración del aviso al servidor (la llenas tú, ver GUIA_ACTUALIZACION_V7.md). Nadie con sesión puede leerla.
CREATE TABLE IF NOT EXISTS private.settings (key text PRIMARY KEY, value text NOT NULL);
REVOKE ALL ON private.settings FROM PUBLIC, anon, authenticated;
-- Cada aviso nuevo se manda a la Edge Function «push» con pg_net, si está activada y configurada.
CREATE OR REPLACE FUNCTION private.push_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE url text; secret text;
BEGIN
  SELECT value INTO url FROM private.settings WHERE key = 'push_url';
  SELECT value INTO secret FROM private.settings WHERE key = 'push_secret';
  IF url IS NULL OR secret IS NULL OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN RETURN new; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = new.user_id) THEN RETURN new; END IF;
  EXECUTE 'SELECT net.http_post(url := $1, body := $2, headers := $3)'
    USING url, jsonb_build_object('user_id', new.user_id, 'kind', new.kind, 'body', new.body, 'ref_id', new.ref_id),
          jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret);
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push: %', SQLERRM;  -- un fallo de push nunca impide guardar el aviso
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_push_notification ON public.notifications;
CREATE TRIGGER trg_push_notification AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION private.push_notification();

-- ───────────────────────── 8. Discord y uso de funciones ─────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_visible boolean NOT NULL DEFAULT false;
-- Contador diario por persona para funciones con costo (IA de VORA, importación de Steam). Solo el servidor lo usa.
CREATE TABLE IF NOT EXISTS public.function_usage (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fn text NOT NULL,
  day date NOT NULL DEFAULT current_date,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, fn, day)
);
ALTER TABLE public.function_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.function_usage FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.function_usage TO service_role;
GRANT SELECT, INSERT ON public.games TO service_role;
GRANT SELECT, INSERT ON public.user_games TO service_role;
CREATE OR REPLACE FUNCTION public.use_function(uid uuid, fname text, max_per_day integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.function_usage(user_id, fn, day, count) VALUES (uid, fname, current_date, 1)
  ON CONFLICT (user_id, fn, day) DO UPDATE SET count = public.function_usage.count + 1 RETURNING count INTO n;
  IF n > max_per_day THEN
    UPDATE public.function_usage SET count = count - 1 WHERE user_id = uid AND fn = fname AND day = current_date;
    RETURN false;
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.use_function(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_function(uuid, text, integer) TO service_role;

-- ───────────────────────── Permisos y tiempo real ─────────────────────────
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION public.acknowledge_strike(uuid), public.second_chance(), public.family_overview(uuid), public.family_lookup(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_strike(uuid), public.second_chance(), public.family_overview(uuid), public.family_lookup(text) TO authenticated;
DO $$DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['guide_requests','waves','league_matches','family_links'] LOOP
      BEGIN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object THEN NULL; END;
    END LOOP;
  END IF;
END $$;
COMMIT;
