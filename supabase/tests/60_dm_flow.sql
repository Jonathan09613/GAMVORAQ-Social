-- Behavioural checks for migration 007 (v12). Runs after 10, 20 and 30 on the same DB.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\o /dev/null
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if not cond then raise exception 'FAIL: %', label; end if; raise notice 'ok  %', label; end $$;
create or replace function pg_temp.denied(stmt text, label text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'ok  %  (%)', label, left(sqlerrm, 70); return; end;
  raise exception 'FAIL: % (statement was allowed)', label;
end $$;
\set A '''aaaaaaaa-0000-0000-0000-00000000000a'''
\set B '''bbbbbbbb-0000-0000-0000-00000000000b'''
-- Flujo completo de un chat entre dos personas, tal como lo hace la app (migraciones 001-008).
insert into auth.users(id, raw_user_meta_data) values ('e1e1e1e1-0000-0000-0000-0000000000e1', '{"display_name":"Deivid"}'), ('e2e2e2e2-0000-0000-0000-0000000000e2', '{"display_name":"Jony"}'), ('e3e3e3e3-0000-0000-0000-0000000000e3', '{"display_name":"Menor"}');
insert into profile_private(user_id, birth_year) values ('e1e1e1e1-0000-0000-0000-0000000000e1', 1993), ('e3e3e3e3-0000-0000-0000-0000000000e3', extract(year from now())::int - 14);
-- Jony NO registró edad.
\set ME '''e1e1e1e1-0000-0000-0000-0000000000e1'''
\set JO '''e2e2e2e2-0000-0000-0000-0000000000e2'''
\set MI '''e3e3e3e3-0000-0000-0000-0000000000e3'''
create temp table cv(id uuid); grant all on cv to authenticated;
begin; select pg_temp.as_user(:ME);
-- 1) Desde el perfil de Jony: «Mensaje» → dm_check y start_dm
select pg_temp.ok(dm_check(:JO) = 'ok', '1. dm_check permite escribir a Jony (sin edad registrada)');
insert into cv select (start_dm(:JO) ->> 'id')::uuid;
select pg_temp.ok((select count(*) from conversations) = 1, '2. se crea la conversación y la veo');
-- 2) Primer mensaje (insert ... returning, como supabase-js)
insert into direct_messages(conversation_id, sender_id, body) select id, :ME, 'Hola Jony, ¿jugamos Blood Strike?' from cv returning id;
select pg_temp.ok(true, '3. envío el primer mensaje');
commit;
begin; select pg_temp.as_user(:JO);
select pg_temp.ok((select count(*) from conversations) = 1, '4. Jony ve la conversación nueva');
select pg_temp.ok((select body from direct_messages limit 1) like 'Hola Jony%', '5. Jony lee el mensaje');
select pg_temp.ok(exists (select 1 from notifications where user_id = 'e2e2e2e2-0000-0000-0000-0000000000e2'), '6. a Jony le llega un aviso (y push si está activo)');
insert into direct_messages(conversation_id, sender_id, body) select id, :JO, '¡Va! En 10 min' from cv;
select pg_temp.ok(true, '7. Jony responde');
-- Jony abre la misma conversación desde mi perfil: start_dm devuelve la MISMA
select pg_temp.ok((start_dm(:ME) ->> 'id')::uuid = (select id from cv), '8. abrir desde el otro perfil reutiliza el mismo chat');
commit;
begin; select pg_temp.as_user(:ME);
select pg_temp.ok((select count(*) from direct_messages) = 2, '9. veo la respuesta');
-- Borrar chat para mí y volver a escribir desde el perfil
insert into conversation_hides(user_id, conversation_id) select :ME, id from cv;
select pg_temp.ok((start_dm(:JO) ->> 'id')::uuid = (select id from cv), '10. tras borrar el chat, escribir otra vez abre el mismo');
select pg_temp.ok(not exists (select 1 from conversation_hides), '10b. y vuelve a aparecer en la lista');
-- Borrar mi mensaje
delete from direct_messages where sender_id = 'e1e1e1e1-0000-0000-0000-0000000000e1';
select pg_temp.ok((select count(*) from direct_messages) = 1, '11. puedo borrar mis mensajes');
delete from direct_messages where sender_id = 'e2e2e2e2-0000-0000-0000-0000000000e2';
select pg_temp.ok((select count(*) from direct_messages) = 1, '12. no puedo borrar los mensajes de la otra persona');
commit;
begin; select pg_temp.as_user(:MI);
select pg_temp.ok(dm_check(:ME) = 'age_band', '13. un menor no puede escribir a un adulto');
select pg_temp.denied($$select start_dm('e1e1e1e1-0000-0000-0000-0000000000e1')$$, '14. ni crear el chat');
rollback;
begin; select pg_temp.as_user(:ME);
select pg_temp.ok(not exists (select 1 from conversations where user_low = 'e3e3e3e3-0000-0000-0000-0000000000e3' or user_high = 'e3e3e3e3-0000-0000-0000-0000000000e3'), '15. no existe chat adulto-menor');
rollback;
\o
\echo 'DM FLOW PASSED'
