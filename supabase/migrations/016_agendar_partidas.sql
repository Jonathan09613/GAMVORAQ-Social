-- GAMVORAQ · 016 · Agendar partidas sin error de permisos.
-- Síntoma: «No puedes agendar en este squad… new row violates row-level security policy for table play_sessions»,
--          aunque seas el dueño del squad.
-- Causa (error de diseño de GAMVORAQ, no de tu base): la regla para VER una partida la buscaba en la tabla por su
-- propio número; al guardarla todavía no existe, así que la regla la rechazaba. Lo mismo pasaba en salas y espacios.
-- Arreglo: las reglas usan los datos de la propia fila y agendar pasa por una función del servidor.
-- Se puede ejecutar varias veces.
BEGIN;

DROP POLICY IF EXISTS "sessions_read" ON public.play_sessions;
CREATE POLICY "sessions_read" ON public.play_sessions FOR SELECT TO authenticated USING (
  host_id = (SELECT auth.uid())
  OR (squad_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.squad_members m WHERE m.squad_id = play_sessions.squad_id AND m.user_id = (SELECT auth.uid())))
  OR (squad_id IS NULL AND public.is_not_blocked(host_id) AND private.same_age_band((SELECT auth.uid()), host_id)));

DO $$ BEGIN
  IF to_regclass('public.pulse_rooms') IS NOT NULL THEN
    DROP POLICY IF EXISTS "pulse_read" ON public.pulse_rooms;
    CREATE POLICY "pulse_read" ON public.pulse_rooms FOR SELECT TO authenticated USING (host_id = (SELECT auth.uid()) OR private.pulse_visible(id));
  END IF;
  IF to_regclass('public.universe_spaces') IS NOT NULL THEN
    DROP POLICY IF EXISTS "spaces_read" ON public.universe_spaces;
    CREATE POLICY "spaces_read" ON public.universe_spaces FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()) OR private.space_visible(id));
  END IF;
END $$;

-- (También está en la 015; se repite por si esta se ejecuta antes.)
CREATE OR REPLACE FUNCTION private.ensure_squad_member(sid uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid());
BEGIN
  IF EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = sid AND user_id = uid) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.squads WHERE id = sid AND owner_id = uid) THEN
    INSERT INTO public.squad_members(squad_id, user_id, role) VALUES (sid, uid, 'owner') ON CONFLICT DO NOTHING; RETURN true;
  END IF;
  RETURN false;
END $$;
GRANT EXECUTE ON FUNCTION private.ensure_squad_member(uuid) TO authenticated;

-- Agendar: valida lo mismo que la regla (fecha, squad, permiso para agendar) y devuelve la partida.
CREATE OR REPLACE FUNCTION public.create_play_session(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid()); sid uuid := nullif(p ->> 'squad_id', '')::uuid; r public.play_sessions;
  t text := trim(coalesce(p ->> 'title', '')); st timestamptz := (p ->> 'starts_at')::timestamptz;
  allowed boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión para agendar'; END IF;
  IF char_length(t) < 3 THEN RAISE EXCEPTION 'El título debe tener al menos 3 caracteres'; END IF;
  IF st IS NULL OR st < now() - interval '10 minutes' THEN RAISE EXCEPTION 'La partida debe ser en el futuro'; END IF;
  IF st > now() + interval '60 days' THEN RAISE EXCEPTION 'Solo se puede agendar hasta 60 días adelante'; END IF;
  IF sid IS NOT NULL THEN
    IF NOT private.ensure_squad_member(sid) THEN RAISE EXCEPTION 'Debes pertenecer a ese squad para agendar'; END IF;
    SELECT EXISTS (SELECT 1 FROM public.squads WHERE id = sid AND owner_id = uid)
        OR EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = sid AND user_id = uid AND role IN ('owner', 'admin'))
        OR coalesce((SELECT members_can_schedule FROM public.squads WHERE id = sid), true)
      INTO allowed;
    IF NOT allowed THEN RAISE EXCEPTION 'En este squad solo el dueño y los admins pueden agendar (se cambia en «Editar squad»)'; END IF;
  ELSIF to_regprocedure('private.has_open_strike(uuid)') IS NOT NULL AND private.has_open_strike(uid) THEN
    RAISE EXCEPTION 'Tienes un aviso de conducta pendiente: por ahora solo puedes agendar dentro de tus squads';
  END IF;
  INSERT INTO public.play_sessions(host_id, squad_id, game_id, title, starts_at, duration_min, capacity, status)
  VALUES (uid, sid, nullif(p ->> 'game_id', '')::bigint, left(t, 80), st,
          least(greatest(coalesce((p ->> 'duration_min')::int, 60), 15), 480),
          least(greatest(coalesce((p ->> 'capacity')::int, 5), 2), 20), 'scheduled')
  RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.create_play_session(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_play_session(jsonb) TO authenticated;
COMMIT;

SELECT 'Agendar partidas' AS "Comprobación", CASE WHEN to_regprocedure('public.create_play_session(jsonb)') IS NOT NULL THEN '✓' ELSE '✗' END AS "Estado";
