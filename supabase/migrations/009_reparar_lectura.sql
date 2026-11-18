-- GAMVORAQ · 009 · Repara las reglas de LECTURA de squads y chats.
-- Síntoma: los squads y chats se crean en la base de datos, pero la app no los muestra
-- (el diagnóstico decía «squads: 0 filas» para tu cuenta). Causa: reglas de lectura (RLS)
-- distintas a las de GAMVORAQ en esas tablas. Esto quita SOLO las reglas de lectura y
-- las restrictivas de esas 5 tablas y vuelve a poner las correctas. Se puede ejecutar varias veces.
-- Al final muestra: 1) las reglas que quedaron y 2) cuántas filas ve tu cuenta (deben ser > 0 si tienes squads).
BEGIN;

-- Primero, guarda qué reglas había (por si quieres revisarlas después).
CREATE TABLE IF NOT EXISTS public._gvq_policy_backup AS SELECT now() AS saved_at, * FROM pg_policies WHERE false;
INSERT INTO public._gvq_policy_backup SELECT now(), * FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('squads', 'squad_members', 'squad_messages', 'conversations', 'direct_messages');
ALTER TABLE public._gvq_policy_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._gvq_policy_backup FROM anon, authenticated;

-- Quita reglas de lectura (SELECT o ALL) y cualquier regla RESTRICTIVA en esas tablas.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('squads', 'squad_members', 'squad_messages', 'conversations', 'direct_messages')
             AND (cmd IN ('SELECT', 'ALL') OR permissive = 'RESTRICTIVE') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- RLS activo (sin FORCE) y permisos de lectura para cuentas con sesión.
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;          ALTER TABLE public.squads NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;   ALTER TABLE public.squad_members NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.squad_messages ENABLE ROW LEVEL SECURITY;  ALTER TABLE public.squad_messages NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;   ALTER TABLE public.conversations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY; ALTER TABLE public.direct_messages NO FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squads, public.squad_members, public.squad_messages, public.conversations, public.direct_messages TO authenticated;

-- Reglas de lectura de GAMVORAQ.
CREATE POLICY "squads_read" ON public.squads FOR SELECT TO authenticated USING (true);
CREATE POLICY "squad_members_read" ON public.squad_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "squad_messages_read" ON public.squad_messages FOR SELECT TO authenticated USING (public.is_squad_member(squad_id));
CREATE POLICY "conversations_read" ON public.conversations FOR SELECT TO authenticated USING (user_low = (SELECT auth.uid()) OR user_high = (SELECT auth.uid()));
CREATE POLICY "dms_read" ON public.direct_messages FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id));

-- Cada squad tiene a su creador como dueño (si faltaba, no salía en «Mis squads»).
INSERT INTO public.squad_members(squad_id, user_id, role)
SELECT s.id, s.owner_id, 'owner' FROM public.squads s
WHERE NOT EXISTS (SELECT 1 FROM public.squad_members m WHERE m.squad_id = s.id AND m.user_id = s.owner_id)
ON CONFLICT DO NOTHING;
COMMIT;

-- ═════ Comprobación ═════
create or replace function pg_temp.gvq_check(mail text) returns table(que text, resultado text) language plpgsql as $$
declare uid uuid := (select id from auth.users where email = mail); n int; t text; p record;
begin
  for p in select tablename, policyname, cmd, permissive from pg_policies where schemaname = 'public'
           and tablename in ('squads', 'squad_members', 'conversations', 'direct_messages', 'squad_messages') order by tablename, cmd loop
    que := 'regla: ' || p.tablename; resultado := p.policyname || ' (' || p.cmd || case when p.permissive = 'RESTRICTIVE' then ', RESTRICTIVA' else '' end || ')'; return next;
  end loop;
  for t in select unnest(array['squads', 'squad_members', 'conversations']) loop
    execute format('select count(*) from public.%I', t) into n;
    que := 'en la base: ' || t; resultado := n || ' filas'; return next;
  end loop;
  if uid is null then que := 'tu cuenta'; resultado := 'no encontré ese correo'; return next; return; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  for t in select unnest(array['squads', 'squad_members', 'conversations']) loop
    begin execute format('select count(*) from public.%I', t) into n; que := 'tu cuenta ve: ' || t; resultado := '✓ ' || n || ' filas';
    exception when others then que := 'tu cuenta ve: ' || t; resultado := '✗ ' || sqlerrm; end;
    return next;
  end loop;
end $$;
select * from pg_temp.gvq_check('deividmora93@gmail.com');
