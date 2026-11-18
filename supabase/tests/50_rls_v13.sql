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
-- Behavioural checks for migration 008 (v13).
\set A '''aaaaaaaa-0000-0000-0000-00000000000a'''
\set M '''a1a1a1a1-0000-0000-0000-0000000000a1'''
\set U '''cccccccc-0000-0000-0000-0000000000cc'''
insert into auth.users(id, raw_user_meta_data) values ('d0d0d0d0-0000-0000-0000-0000000000d0', '{"display_name":"Dieciocho"}'), ('d1d1d1d1-0000-0000-0000-0000000000d1', '{"display_name":"SinEdad"}');
insert into profile_private(user_id, birth_year) values ('d0d0d0d0-0000-0000-0000-0000000000d0', extract(year from now())::int - 18);
\set D '''d0d0d0d0-0000-0000-0000-0000000000d0'''
\set N '''d1d1d1d1-0000-0000-0000-0000000000d1'''
select pg_temp.ok(private.age_band(:D) = 'adult', 'turning 18 this year counts as adult');
begin; select pg_temp.as_user(:N);
select pg_temp.ok(dm_check(:D) = 'ok' and dm_check(:M) = 'age_band', 'no age: can message adults, never minors');
select pg_temp.ok((start_dm(:D) ->> 'id') is not null, 'start_dm opens a chat without age registered');
select pg_temp.ok((start_dm(:D) ->> 'id') = (start_dm(:D) ->> 'id'), 'start_dm returns the same chat twice');
select pg_temp.denied($$select start_dm('a1a1a1a1-0000-0000-0000-0000000000a1')$$, 'start_dm refuses adult/unknown -> minor');
select pg_temp.ok((create_squad('{"name":"Los Pros","description":"Buscamos pasar el rato","privacy":"abierto","max_members":"6","members_can_schedule":true}') ->> 'age_band') = 'adult', 'create_squad works without age (adult band)');
select pg_temp.ok(exists (select 1 from squad_members m join squads s on s.id = m.squad_id where s.name = 'Los Pros' and m.role = 'owner'), 'creator becomes owner');
select pg_temp.denied($$select create_squad('{"name":"x"}')$$, 'short squad name gives a clear error');
commit;
begin; select pg_temp.as_user(:M);
select pg_temp.denied($$insert into squad_members(squad_id, user_id, role) values ((select id from squads where name = 'Los Pros'), 'a1a1a1a1-0000-0000-0000-0000000000a1', 'member')$$, 'a minor cannot join an adult squad');
rollback;
set session_replication_role = replica; update quests set created_at = now() - interval '5 minutes'; set session_replication_role = origin;
insert into communities(id, owner_id, name) values ('78000000-0000-0000-0000-000000000001', :A, 'Comunidad A');
begin; select pg_temp.as_user(:N);
select pg_temp.denied($$select create_quest('{"title":"Reto de prueba","community_id":"78000000-0000-0000-0000-000000000001"}')$$, 'non-member gets «Únete a esa comunidad»');
rollback;
insert into community_members(community_id, user_id, role) values ('78000000-0000-0000-0000-000000000001', :N, 'member');
begin; select pg_temp.as_user(:N);
select pg_temp.ok((create_quest('{"title":"Reto de prueba","badge_name":"Leyenda del squad","community_id":"78000000-0000-0000-0000-000000000001"}') ->> 'badge_name') = 'Leyenda del squad', 'member creates a challenge with a custom badge');
rollback;
insert into communities(id, owner_id, name) values ('78000000-0000-0000-0000-000000000002', :D, 'Comunidad D');
delete from community_members where community_id = '78000000-0000-0000-0000-000000000002' and user_id = :D;
begin; select pg_temp.as_user(:D);
select pg_temp.ok((create_quest('{"title":"Reto del fundador","community_id":"78000000-0000-0000-0000-000000000002"}') ->> 'id') is not null, 'founder with a missing membership row is repaired');
rollback;
insert into games(name) values ('Juego Sin Portada') on conflict do nothing;
begin; select pg_temp.as_user(:N);
select pg_temp.ok(set_game_covers(jsonb_build_array(jsonb_build_object('id', (select id from games where name = 'Juego Sin Portada'), 'appid', 570, 'url', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/header.jpg'))) = 1, 'saves an official Steam cover');
select pg_temp.ok(set_game_covers(jsonb_build_array(jsonb_build_object('id', (select id from games where name = 'Juego Sin Portada'), 'url', 'https://evil.example.com/x.jpg', 'replace', true))) = 0, 'rejects non-Steam images');
rollback;
\o
\echo 'ALL V13 RLS CHECKS PASSED'
