-- GAMVORAQ v13 · Ejecutar DESPUÉS de 007. Se puede volver a ejecutar sin errores.
-- Al final muestra una tabla de comprobación: todas las filas deben decir «✓».
--
--  1. Edad: desde los 18 años se cuenta como adulto (antes eran 19, por eso salía «menor» sin serlo).
--  2. Mensajes: si nadie es menor, se pueden escribir aunque alguien no haya registrado su edad.
--     Lo único que se bloquea: menores con adultos (o con perfiles sin edad) y los bloqueos.
--  3. Squads y retos: se crean con funciones del servidor que validan todo y explican el error exacto.
--  4. Chats: se inician con una función del servidor (sin errores de permisos).
--  5. Portadas de juegos: la app guarda la portada oficial de Steam de cada juego para todas las personas.
BEGIN;

-- ═════════ 1 y 2 · EDAD Y MENSAJES ═════════
CREATE OR REPLACE FUNCTION private.age_band(uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE
    WHEN p.birth_year IS NULL THEN 'unknown'
    WHEN extract(year FROM now())::int - p.birth_year >= 18 THEN 'adult'
    ELSE 'minor' END
  FROM (SELECT (SELECT birth_year FROM public.profile_private WHERE user_id = uid) AS birth_year) p;
$$;
-- Menores solo con menores. Adultos y perfiles sin edad pueden hablar entre sí.
CREATE OR REPLACE FUNCTION private.can_interact(a uuid, b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE WHEN private.age_band(a) = 'minor' OR private.age_band(b) = 'minor'
              THEN private.age_band(a) = 'minor' AND private.age_band(b) = 'minor'
              ELSE true END;
$$;
CREATE OR REPLACE FUNCTION public.dm_check(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN 'login'
    WHEN target = (SELECT auth.uid()) THEN 'self'
    WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target) THEN 'missing'
    WHEN EXISTS (SELECT 1 FROM public.blocks WHERE (blocker_id = (SELECT auth.uid()) AND blocked_id = target) OR (blocker_id = target AND blocked_id = (SELECT auth.uid()))) THEN 'blocked'
    WHEN EXISTS (SELECT 1 FROM public.suspensions s WHERE s.user_id = (SELECT auth.uid()) AND s.until > now()) THEN 'suspended'
    WHEN NOT private.can_interact((SELECT auth.uid()), target) THEN 'age_band'
    ELSE 'ok' END;
$$;

-- Squads: el rango del squad es «minor» o «adult» (sin edad cuenta como adulto, nunca entra a squads de menores).
UPDATE public.squads SET age_band = 'adult' WHERE age_band IS NULL OR age_band = 'unknown';
CREATE OR REPLACE FUNCTION private.band2(uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE WHEN private.age_band(uid) = 'minor' THEN 'minor' ELSE 'adult' END;
$$;
CREATE OR REPLACE FUNCTION private.squad_fits(sid uuid, uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.squads s WHERE s.id = sid
    AND coalesce(nullif(s.age_band, 'unknown'), 'adult') = private.band2(uid)
    AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE (b.blocker_id = s.owner_id AND b.blocked_id = uid) OR (b.blocker_id = uid AND b.blocked_id = s.owner_id))
    AND (SELECT count(*) FROM public.squad_members m WHERE m.squad_id = sid) < s.max_members);
$$;
CREATE OR REPLACE FUNCTION private.before_squad() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    IF (SELECT count(*) FROM public.squads WHERE owner_id = new.owner_id) >= 5 THEN RAISE EXCEPTION 'Puedes crear como máximo 5 squads. Elimina uno para crear otro.'; END IF;
    new.age_band := private.band2(new.owner_id);
  ELSE
    new.age_band := old.age_band;
    IF coalesce(current_setting('gvq.transfer', true), '') <> 'on' THEN new.owner_id := old.owner_id; END IF;
    IF new.max_members < (SELECT count(*) FROM public.squad_members WHERE squad_id = new.id) THEN
      RAISE EXCEPTION 'El cupo no puede ser menor que los integrantes actuales';
    END IF;
  END IF;
  RETURN new;
END $$;

-- Reparación: todo squad tiene a su creador como dueño (si faltaba, no aparecía en «Mis squads»).
INSERT INTO public.squad_members(squad_id, user_id, role)
SELECT s.id, s.owner_id, 'owner' FROM public.squads s
WHERE NOT EXISTS (SELECT 1 FROM public.squad_members m WHERE m.squad_id = s.id AND m.user_id = s.owner_id)
ON CONFLICT DO NOTHING;
UPDATE public.squad_members m SET role = 'owner' FROM public.squads s WHERE s.id = m.squad_id AND s.owner_id = m.user_id AND m.role <> 'owner';

-- ═════════ 3 · CREAR SQUADS Y RETOS (con mensajes claros) ═════════
CREATE OR REPLACE FUNCTION public.create_squad(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid()); r public.squads; nm text := trim(coalesce(p ->> 'name', ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión para crear un squad'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN RAISE EXCEPTION 'Tu perfil no está completo. Cierra sesión y vuelve a entrar.'; END IF;
  IF char_length(nm) < 2 OR char_length(nm) > 60 THEN RAISE EXCEPTION 'El nombre del squad debe tener entre 2 y 60 caracteres'; END IF;
  INSERT INTO public.squads(owner_id, name, description, game_id, privacy, max_members, members_can_schedule)
  VALUES (uid, nm, left(coalesce(p ->> 'description', ''), 400), nullif(p ->> 'game_id', '')::bigint,
          CASE WHEN p ->> 'privacy' = 'invitacion' THEN 'invitacion' ELSE 'abierto' END,
          greatest(2, least(50, coalesce(nullif(p ->> 'max_members', '')::int, 12))),
          coalesce((p ->> 'members_can_schedule')::boolean, true))
  RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;
CREATE OR REPLACE FUNCTION public.create_quest(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid()); r public.quests; cid uuid := nullif(p ->> 'community_id', '')::uuid;
  t text := trim(coalesce(p ->> 'title', '')); b text := trim(coalesce(nullif(p ->> 'badge_name', ''), 'Compañero GG'));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión para crear un reto'; END IF;
  IF char_length(t) < 4 THEN RAISE EXCEPTION 'El título del reto debe tener al menos 4 caracteres'; END IF;
  IF char_length(b) < 3 THEN RAISE EXCEPTION 'El nombre de la insignia debe tener al menos 3 caracteres'; END IF;
  IF cid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.communities WHERE id = cid) THEN RAISE EXCEPTION 'Esa comunidad ya no existe'; END IF;
  IF cid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = cid AND user_id = uid) THEN
    -- Si la creaste o la moderas pero faltaba tu registro de integrante, se repara solo.
    IF EXISTS (SELECT 1 FROM public.communities WHERE id = cid AND owner_id = uid) THEN
      INSERT INTO public.community_members(community_id, user_id, role) VALUES (cid, uid, 'owner') ON CONFLICT DO NOTHING;
    ELSE RAISE EXCEPTION 'Únete a esa comunidad para crear retos en ella'; END IF;
  END IF;
  INSERT INTO public.quests(creator_id, community_id, title, description, badge_name)
  VALUES (uid, cid, left(t, 90), left(coalesce(p ->> 'description', ''), 1600), left(b, 48)) RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;

-- ═════════ 4 · INICIAR CHAT ═════════
CREATE OR REPLACE FUNCTION public.start_dm(target uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid()); why text := public.dm_check(target); lo uuid; hi uuid; r public.conversations;
BEGIN
  IF why <> 'ok' THEN
    RAISE EXCEPTION '%', CASE why
      WHEN 'login' THEN 'Inicia sesión para escribir'
      WHEN 'self' THEN 'No puedes escribirte a ti mismo'
      WHEN 'missing' THEN 'Esa cuenta ya no existe'
      WHEN 'blocked' THEN 'Hay un bloqueo entre ustedes'
      WHEN 'suspended' THEN 'Tu cuenta está en pausa por moderación'
      ELSE 'Por protección de menores, un menor de edad solo puede escribirse con otros menores' END;
  END IF;
  lo := least(uid, target); hi := greatest(uid, target);
  INSERT INTO public.conversations(user_low, user_high) VALUES (lo, hi) ON CONFLICT (user_low, user_high) DO NOTHING;
  DELETE FROM public.conversation_hides WHERE user_id = uid AND conversation_id = (SELECT id FROM public.conversations WHERE user_low = lo AND user_high = hi);
  SELECT * INTO r FROM public.conversations WHERE user_low = lo AND user_high = hi;
  RETURN to_jsonb(r);
END $$;

-- ═════════ 5 · PORTADAS DE JUEGOS ═════════
-- Solo acepta imágenes de los servidores oficiales de Steam y solo llena portadas vacías (o rotas, si se pide).
CREATE OR REPLACE FUNCTION public.set_game_covers(items jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE it jsonb; n integer := 0; url text; app bigint;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR jsonb_typeof(items) <> 'array' THEN RETURN 0; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(items) LIMIT 60 LOOP
    url := it ->> 'url'; app := nullif(it ->> 'appid', '')::bigint;
    IF url IS NULL OR url !~ '^https://(shared|cdn)\.(akamai|cloudflare|fastly)\.steamstatic\.com/[A-Za-z0-9_./-]+\.(jpg|png)(\?[a-z0-9=&]*)?$' THEN CONTINUE; END IF;
    UPDATE public.games SET image_url = url, steam_appid = coalesce(steam_appid, app)
     WHERE id = (it ->> 'id')::bigint AND (image_url IS NULL OR image_url ~ 'steamstatic\.com' AND coalesce((it ->> 'replace')::boolean, false));
    IF FOUND THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;

-- Música del squad: hasta 20 canciones por minuto (antes 8), para armar la playlist de una vez.
DO $$ BEGIN
  IF to_regclass('public.squad_tracks') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_guard_content ON public.squad_tracks;
    CREATE TRIGGER trg_guard_content BEFORE INSERT ON public.squad_tracks FOR EACH ROW EXECUTE FUNCTION private.guard_content('user_id', 'note', '20');
  END IF;
END $$;

-- ═════════ PERMISOS ═════════
REVOKE ALL ON FUNCTION public.create_squad(jsonb), public.create_quest(jsonb), public.start_dm(uuid), public.set_game_covers(jsonb), public.dm_check(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_squad(jsonb), public.create_quest(jsonb), public.start_dm(uuid), public.set_game_covers(jsonb), public.dm_check(uuid) TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
-- Tiempo real: cuando alguien abre un chat contigo, aparece al instante en tu lista.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.gvq_version() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 13 $$;
GRANT EXECUTE ON FUNCTION public.gvq_version() TO authenticated, anon;
COMMIT;

-- ═════════ COMPROBACIÓN (debe salir ✓ en todas las filas) ═════════
SELECT check_name AS "Comprobación", CASE WHEN ok THEN '✓' ELSE '✗ FALTA' END AS "Estado" FROM (VALUES
  ('Migración 006 (squads con roles)', to_regclass('public.squad_invites') IS NOT NULL),
  ('Migración 007 (moderación, música, encuestas)', to_regclass('public.squad_tracks') IS NOT NULL AND to_regclass('public.suspensions') IS NOT NULL),
  ('Migración 008 (esta)', to_regprocedure('public.create_squad(jsonb)') IS NOT NULL),
  ('Permisos de funciones internas', has_function_privilege('authenticated', 'private.can_interact(uuid,uuid)', 'EXECUTE') AND has_function_privilege('authenticated', 'private.is_squad_staff(uuid)', 'EXECUTE')),
  ('Portadas de juegos (columnas)', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'image_url')),
  ('Buckets de imágenes', (SELECT count(*) FROM storage.buckets WHERE id IN ('gamvoraq', 'gamvoraq-memories')) = 2)
) AS t(check_name, ok);
