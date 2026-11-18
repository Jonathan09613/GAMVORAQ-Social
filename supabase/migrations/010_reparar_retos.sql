-- GAMVORAQ · 010 · Repara las reglas de LECTURA de retos y comunidades (igual que la 009 con los squads).
-- Síntoma: el reto se crea (está en la base de datos) pero la comunidad dice «No hay retos».
-- Causa: reglas de lectura (RLS) distintas a las de GAMVORAQ que esconden las filas a tu cuenta.
-- Quita SOLO las reglas de lectura y las RESTRICTIVAS de estas 5 tablas y pone las correctas.
-- Las reglas para crear, editar y borrar no se tocan. Se puede ejecutar varias veces.
BEGIN;

CREATE TABLE IF NOT EXISTS public._gvq_policy_backup AS SELECT now() AS saved_at, * FROM pg_policies WHERE false;
INSERT INTO public._gvq_policy_backup SELECT now(), * FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('quests', 'quest_entries', 'badges', 'communities', 'community_members');
ALTER TABLE public._gvq_policy_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._gvq_policy_backup FROM anon, authenticated;

DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('quests', 'quest_entries', 'badges', 'communities', 'community_members')
             AND (cmd = 'SELECT' OR permissive = 'RESTRICTIVE') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;            ALTER TABLE public.quests NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quest_entries ENABLE ROW LEVEL SECURITY;     ALTER TABLE public.quest_entries NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;            ALTER TABLE public.badges NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;       ALTER TABLE public.communities NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY; ALTER TABLE public.community_members NO FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quests, public.quest_entries, public.badges, public.communities, public.community_members TO authenticated;

-- Reglas de lectura de GAMVORAQ: retos, insignias y comunidades son visibles para cualquier cuenta;
-- la participación en un reto la ve la persona, quien lo creó y el staff de la comunidad.
CREATE POLICY "quests_read" ON public.quests FOR SELECT TO authenticated USING (true);
CREATE POLICY "badges_read" ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "communities_read" ON public.communities FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_read" ON public.community_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "quest_entries_read" ON public.quest_entries FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.quests q WHERE q.id = quest_id
    AND (q.creator_id = (SELECT auth.uid()) OR (q.community_id IS NOT NULL AND public.is_community_staff(q.community_id)))));

-- Quien creó una comunidad aparece como dueño (si faltaba, no podía crear retos en ella).
INSERT INTO public.community_members(community_id, user_id, role)
SELECT c.id, c.owner_id, 'owner' FROM public.communities c
WHERE c.owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = c.id AND m.user_id = c.owner_id)
ON CONFLICT DO NOTHING;

-- Retos nuevos al instante en todas las pantallas abiertas.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.quests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
COMMIT;

-- ═════ Comprobación: lo que hay en la base y lo que ve tu cuenta (deben coincidir) ═════
create or replace function pg_temp.gvq_check10(mail text) returns table(que text, resultado text) language plpgsql as $$
declare uid uuid := (select id from auth.users where email = mail); n int; t text;
begin
  for t in select unnest(array['quests', 'communities', 'community_members']) loop
    execute format('select count(*) from public.%I', t) into n; que := 'en la base: ' || t; resultado := n || ' filas'; return next;
  end loop;
  if uid is null then que := 'tu cuenta'; resultado := 'no encontré ese correo'; return next; return; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  for t in select unnest(array['quests', 'communities', 'community_members']) loop
    begin execute format('select count(*) from public.%I', t) into n; que := 'tu cuenta ve: ' || t; resultado := '✓ ' || n || ' filas';
    exception when others then que := 'tu cuenta ve: ' || t; resultado := '✗ ' || sqlerrm; end;
    return next;
  end loop;
end $$;
select * from pg_temp.gvq_check10('deividmora93@gmail.com');
