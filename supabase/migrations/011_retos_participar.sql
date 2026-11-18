-- GAMVORAQ · 011 · Participar en retos sin errores de permisos.
-- Síntoma: «No tienes permiso para hacer eso (quest_entries) · new row violates row-level security policy».
-- Arreglo: 1) vuelve a poner las reglas de escritura correctas en quest_entries;
--          2) participar, enviar evidencia, revisar y salir pasan por funciones del servidor
--             que validan todo ellas mismas (ya no dependen de reglas raras en tu base).
-- Se puede ejecutar varias veces.
BEGIN;

-- ═════ 1 · Reglas de quest_entries (respaldo + limpieza + reglas de GAMVORAQ) ═════
CREATE TABLE IF NOT EXISTS public._gvq_policy_backup AS SELECT now() AS saved_at, * FROM pg_policies WHERE false;
INSERT INTO public._gvq_policy_backup SELECT now(), * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quest_entries';
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quest_entries' LOOP
    EXECUTE format('DROP POLICY %I ON public.quest_entries', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.quest_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_entries NO FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quest_entries TO authenticated;

CREATE POLICY "quest_entries_read" ON public.quest_entries FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.quests q WHERE q.id = quest_id
    AND (q.creator_id = (SELECT auth.uid()) OR (q.community_id IS NOT NULL AND public.is_community_staff(q.community_id)))));
CREATE POLICY "quest_entries_join" ON public.quest_entries FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND status = 'joined' AND coalesce(proof, '') = '');
CREATE POLICY "quest_entries_submit" ON public.quest_entries FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND status IN ('joined', 'rejected'))
  WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'submitted' AND length(trim(proof)) >= 5);
CREATE POLICY "quest_entries_review" ON public.quest_entries FOR UPDATE TO authenticated
  USING (status = 'submitted' AND user_id <> (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.quests q WHERE q.id = quest_id
    AND (q.creator_id = (SELECT auth.uid()) OR (q.community_id IS NOT NULL AND public.is_community_staff(q.community_id)))))
  WITH CHECK (status IN ('approved', 'rejected') AND user_id <> (SELECT auth.uid()));
CREATE POLICY "quest_entries_leave" ON public.quest_entries FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND status IN ('joined', 'rejected', 'submitted'));

-- ═════ 2 · Funciones del servidor ═════
CREATE OR REPLACE FUNCTION public.join_quest(target uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid()); q public.quests; r public.quest_entries;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión para participar'; END IF;
  SELECT * INTO q FROM public.quests WHERE id = target;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ese reto ya no existe'; END IF;
  IF q.ends_at IS NOT NULL AND q.ends_at <= now() THEN RAISE EXCEPTION 'Ese reto ya terminó'; END IF;
  IF EXISTS (SELECT 1 FROM public.blocks b WHERE (b.blocker_id = uid AND b.blocked_id = q.creator_id) OR (b.blocker_id = q.creator_id AND b.blocked_id = uid)) THEN
    RAISE EXCEPTION 'No puedes participar en retos de alguien con quien hay un bloqueo';
  END IF;
  INSERT INTO public.quest_entries(quest_id, user_id, status, proof) VALUES (target, uid, 'joined', '')
  ON CONFLICT (quest_id, user_id) DO NOTHING;
  SELECT * INTO r FROM public.quest_entries WHERE quest_id = target AND user_id = uid;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.leave_quest(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid());
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
  IF EXISTS (SELECT 1 FROM public.quest_entries WHERE quest_id = target AND user_id = uid AND status = 'approved') THEN
    RAISE EXCEPTION 'Ya ganaste la insignia de este reto: tu participación queda guardada';
  END IF;
  DELETE FROM public.quest_entries WHERE quest_id = target AND user_id = uid;
END $$;

CREATE OR REPLACE FUNCTION public.submit_quest_proof(target uuid, proof_text text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid()); p text := left(trim(coalesce(proof_text, '')), 1600); r public.quest_entries;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
  IF char_length(p) < 5 THEN RAISE EXCEPTION 'Describe tu participación con al menos 5 caracteres'; END IF;
  -- Si no se había unido, se une al enviar la evidencia.
  INSERT INTO public.quest_entries(quest_id, user_id, status, proof) VALUES (target, uid, 'joined', '') ON CONFLICT (quest_id, user_id) DO NOTHING;
  UPDATE public.quest_entries SET proof = p, status = 'submitted', reviewed_at = NULL
   WHERE quest_id = target AND user_id = uid AND status IN ('joined', 'rejected', 'submitted') RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este reto ya está aprobado para ti'; END IF;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.review_quest_entry(target uuid, participant uuid, approve boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid()); q public.quests; r public.quest_entries;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
  SELECT * INTO q FROM public.quests WHERE id = target;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ese reto ya no existe'; END IF;
  IF participant = uid THEN RAISE EXCEPTION 'No puedes aprobar tu propia participación'; END IF;
  IF NOT (q.creator_id = uid OR (q.community_id IS NOT NULL AND public.is_community_staff(q.community_id))) THEN
    RAISE EXCEPTION 'Solo quien organiza el reto o el staff de la comunidad puede revisar';
  END IF;
  UPDATE public.quest_entries SET status = CASE WHEN approve THEN 'approved' ELSE 'rejected' END, reviewed_at = now()
   WHERE quest_id = target AND user_id = participant AND status = 'submitted' RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa participación ya fue revisada o no ha enviado evidencia'; END IF;
  RETURN to_jsonb(r);
END $$;

-- Mis retos: los que creé, en los que participo y los de mis comunidades, aunque las reglas de lectura fallen.
CREATE OR REPLACE FUNCTION public.my_quests() RETURNS SETOF public.quests LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT q.* FROM public.quests q
  WHERE q.creator_id = (SELECT auth.uid())
     OR EXISTS (SELECT 1 FROM public.quest_entries e WHERE e.quest_id = q.id AND e.user_id = (SELECT auth.uid()))
     OR q.community_id IS NULL
     OR EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = q.community_id AND m.user_id = (SELECT auth.uid()))
  ORDER BY q.created_at DESC LIMIT 200;
$$;
-- Participaciones de mis retos (las mías y, si organizo, las de los demás) para contar y revisar.
CREATE OR REPLACE FUNCTION public.my_quest_entries() RETURNS SETOF public.quest_entries LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT e.* FROM public.quest_entries e JOIN public.quests q ON q.id = e.quest_id
  WHERE e.user_id = (SELECT auth.uid()) OR q.creator_id = (SELECT auth.uid())
     OR (q.community_id IS NOT NULL AND public.is_community_staff(q.community_id))
  ORDER BY e.created_at DESC LIMIT 1000;
$$;

REVOKE ALL ON FUNCTION public.join_quest(uuid), public.leave_quest(uuid), public.submit_quest_proof(uuid, text), public.review_quest_entry(uuid, uuid, boolean), public.my_quests(), public.my_quest_entries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_quest(uuid), public.leave_quest(uuid), public.submit_quest_proof(uuid, text), public.review_quest_entry(uuid, uuid, boolean), public.my_quests(), public.my_quest_entries() TO authenticated;

-- Participaciones en tiempo real (el organizador ve al instante quién se une o envía evidencia).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.quest_entries; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
COMMIT;

-- ═════ Comprobación ═════
SELECT 'Funciones de retos' AS "Comprobación",
       CASE WHEN to_regprocedure('public.join_quest(uuid)') IS NOT NULL AND to_regprocedure('public.my_quests()') IS NOT NULL THEN '✓' ELSE '✗ FALTA' END AS "Estado"
UNION ALL
SELECT 'Reglas de participación', CASE WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quest_entries') = 5 THEN '✓' ELSE '✗ revisar' END;
