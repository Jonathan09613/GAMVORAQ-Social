-- Behavioural checks for migration 006 (v11). Runs after 10 and 20 on the same DB (reuses A, B adults; M, M2 minors; U unknown).
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
\set M '''a1a1a1a1-0000-0000-0000-0000000000a1'''
\set M2 '''a2a2a2a2-0000-0000-0000-0000000000a2'''
\set U '''cccccccc-0000-0000-0000-0000000000cc'''
insert into auth.users(id, raw_user_meta_data) values ('eeeeeeee-0000-0000-0000-0000000000ee', '{"display_name":"Eva"}');
insert into profile_private(user_id, birth_year) values ('eeeeeeee-0000-0000-0000-0000000000ee', 2000);
\set E '''eeeeeeee-0000-0000-0000-0000000000ee'''

\echo '--- minors'
begin; select pg_temp.as_user(:M);
select pg_temp.denied($$update profile_private set birth_year = 1990 where user_id = 'a1a1a1a1-0000-0000-0000-0000000000a1'$$, 'a minor cannot change the birth year to look like an adult');
rollback;
begin; select pg_temp.as_user(:U);
-- v13 (migración 008): sin edad registrada se puede hablar con adultos, nunca con menores.
select pg_temp.ok(private_ok(array['aaaaaaaa-0000-0000-0000-00000000000a']::uuid[]) = array['aaaaaaaa-0000-0000-0000-00000000000a']::uuid[], 'no registered age -> can talk with adults (v13)');
select pg_temp.ok(private_ok(array['a1a1a1a1-0000-0000-0000-0000000000a1']::uuid[]) = '{}', 'no registered age -> never with minors');
rollback;
begin; select pg_temp.as_user(:U);
insert into profile_private(user_id, birth_year) values (:U, 1998);
select pg_temp.ok(my_age_band() = 'adult', 'registering the year once works');
rollback;
insert into availability(user_id, until, mode) values (:M, now() + interval '1 hour', 'normal') on conflict (user_id) do update set until = excluded.until, mode = excluded.mode;
begin; select pg_temp.as_user(:A);
select pg_temp.ok(not exists (select 1 from availability where user_id = 'a1a1a1a1-0000-0000-0000-0000000000a1'), 'adults do not see when a minor is available');
select pg_temp.denied($$insert into follows(follower_id, followed_id) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a1a1a1a1-0000-0000-0000-0000000000a1')$$, 'an adult cannot follow a minor');
select pg_temp.denied($$insert into follows(follower_id, followed_id) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-00000000000a')$$, 'nobody follows themselves');
rollback;
begin; select pg_temp.as_user(:M2);
select pg_temp.ok(exists (select 1 from availability where user_id = 'a1a1a1a1-0000-0000-0000-0000000000a1'), 'minors see other minors available');
insert into follows(follower_id, followed_id) values (:M2, :A) on conflict do nothing;
select pg_temp.ok(true, 'a minor can follow an adult creator');
rollback;

\echo '--- squads: limits, age and privacy'
begin; select pg_temp.as_user(:E);
insert into squads(id, owner_id, name, privacy, max_members) values
 ('60000000-0000-0000-0000-000000000001', :E, 'Squad Uno', 'abierto', 3),
 ('60000000-0000-0000-0000-000000000002', :E, 'Squad Dos', 'invitacion', 12),
 ('60000000-0000-0000-0000-000000000003', :E, 'Squad Tres', 'abierto', 12),
 ('60000000-0000-0000-0000-000000000004', :E, 'Squad Cuatro', 'abierto', 12),
 ('60000000-0000-0000-0000-000000000005', :E, 'Squad Cinco', 'abierto', 12);
select pg_temp.denied($$insert into squads(owner_id, name) values ('eeeeeeee-0000-0000-0000-0000000000ee', 'Squad Seis')$$, 'max 5 squads created per person');
select pg_temp.ok((select age_band from squads where id = '60000000-0000-0000-0000-000000000001') = 'adult', 'squad takes the owner age band');
select pg_temp.ok((select role from squad_members where squad_id = '60000000-0000-0000-0000-000000000001' and user_id = 'eeeeeeee-0000-0000-0000-0000000000ee') = 'owner', 'creator is owner');
commit;
begin; select pg_temp.as_user(:M);
select pg_temp.denied($$insert into squad_members(squad_id, user_id) values ('60000000-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-0000000000a1')$$, 'a minor cannot join an adult squad');
rollback;
begin; select pg_temp.as_user(:A);
insert into squad_members(squad_id, user_id) values ('60000000-0000-0000-0000-000000000001', :A);
select pg_temp.denied($$insert into squad_members(squad_id, user_id) values ('60000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a')$$, 'invite-only squad cannot be joined directly');
select pg_temp.denied($$insert into play_sessions(host_id, squad_id, title, starts_at) values ('aaaaaaaa-0000-0000-0000-00000000000a', '60000000-0000-0000-0000-000000000001', 'X', now() + interval '1 hour')$$, 'a plain member cannot schedule squad sessions');
select pg_temp.denied($$update squad_members set role = 'admin' where squad_id = '60000000-0000-0000-0000-000000000001' and user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$, 'a member cannot promote themselves');
update squads set name = 'Hackeado' where id = '60000000-0000-0000-0000-000000000001';
commit;
select pg_temp.ok((select name from squads where id = '60000000-0000-0000-0000-000000000001') = 'Squad Uno', 'a member cannot edit the squad');
begin; select pg_temp.as_user(:E);
update squad_members set role = 'admin' where squad_id = '60000000-0000-0000-0000-000000000001' and user_id = :A;
commit;
select pg_temp.ok((select count(*) from notifications where user_id = :A and kind = 'squad' and body like 'Ahora eres admin%') = 1, 'promoted member is notified');
begin; select pg_temp.as_user(:A);
insert into play_sessions(host_id, squad_id, title, starts_at) values (:A, '60000000-0000-0000-0000-000000000001', 'Admin agenda', now() + interval '1 hour');
update squads set description = 'Editado por admin' where id = '60000000-0000-0000-0000-000000000001';
select pg_temp.ok((select description from squads where id = '60000000-0000-0000-0000-000000000001') = 'Editado por admin', 'admins schedule and edit');
update squads set owner_id = 'aaaaaaaa-0000-0000-0000-00000000000a' where id = '60000000-0000-0000-0000-000000000001';
select pg_temp.ok((select owner_id from squads where id = '60000000-0000-0000-0000-000000000001') = 'eeeeeeee-0000-0000-0000-0000000000ee', 'admins cannot take ownership by editing');
insert into squad_invites(squad_id, user_id, invited_by) values ('60000000-0000-0000-0000-000000000001', :B, :A);
select pg_temp.denied($$insert into squad_invites(squad_id, user_id, invited_by) values ('60000000-0000-0000-0000-000000000001', 'a2a2a2a2-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-00000000000a')$$, 'cannot invite a minor to an adult squad');
commit;
select pg_temp.ok((select count(*) from notifications where user_id = :B and kind = 'squad_invite') = 1, 'invited person is notified');
begin; select pg_temp.as_user(:B);
select accept_squad_invite('60000000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from squad_members where squad_id = '60000000-0000-0000-0000-000000000001') = 3, 'accepting the invite joins the squad');
commit;
begin; select pg_temp.as_user(:M2);
rollback;
-- capacity 3 reached
insert into auth.users(id, raw_user_meta_data) values ('ffffffff-0000-0000-0000-0000000000ff', '{"display_name":"Fer"}');
insert into profile_private(user_id, birth_year) values ('ffffffff-0000-0000-0000-0000000000ff', 1993);
begin; select pg_temp.as_user('ffffffff-0000-0000-0000-0000000000ff');
select pg_temp.denied($$insert into squad_members(squad_id, user_id) values ('60000000-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-0000000000ff')$$, 'full squad rejects new members');
rollback;
begin; select pg_temp.as_user(:A);
delete from squad_members where squad_id = '60000000-0000-0000-0000-000000000001' and user_id = :E;
select pg_temp.ok(exists (select 1 from squad_members where squad_id = '60000000-0000-0000-0000-000000000001' and user_id = 'eeeeeeee-0000-0000-0000-0000000000ee'), 'an admin cannot remove the owner');
delete from squad_members where squad_id = '60000000-0000-0000-0000-000000000001' and user_id = :B;
commit;
select pg_temp.ok((select count(*) from squad_members where squad_id = '60000000-0000-0000-0000-000000000001') = 2, 'an admin can remove a member');
select pg_temp.ok((select count(*) from notifications where user_id = :B and body like 'Ya no formas parte de%') = 1, 'the removed member is notified');
begin; select pg_temp.as_user(:E);
select transfer_squad('60000000-0000-0000-0000-000000000001', :A);
commit;
select pg_temp.ok((select owner_id from squads where id = '60000000-0000-0000-0000-000000000001') = 'aaaaaaaa-0000-0000-0000-00000000000a'
  and (select role from squad_members where squad_id = '60000000-0000-0000-0000-000000000001' and user_id = 'eeeeeeee-0000-0000-0000-0000000000ee') = 'admin', 'transfer makes the new owner and keeps the old one as admin');
begin; select pg_temp.as_user(:A);
delete from squad_members where squad_id = '60000000-0000-0000-0000-000000000001' and user_id = :A;
select pg_temp.ok(exists (select 1 from squad_members where squad_id = '60000000-0000-0000-0000-000000000001' and user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 'the owner cannot simply leave (must transfer or delete)');
rollback;

\echo '--- messages'
insert into squad_members(squad_id, user_id) values ('60000000-0000-0000-0000-000000000003', :B);
begin; select pg_temp.as_user(:E);
insert into squad_messages(squad_id, sender_id, body) values ('60000000-0000-0000-0000-000000000003', :E, 'hola squad');
insert into squad_messages(squad_id, sender_id, body) values ('60000000-0000-0000-0000-000000000003', :E, 'segundo mensaje');
commit;
select pg_temp.ok((select count(*) from notifications where user_id = :B and kind = 'squad_message' and read_at is null) = 1, 'squad chat notifies once per chat, not per message');
select pg_temp.ok((select body from notifications where user_id = :B and kind = 'squad_message') like '%segundo mensaje', 'the grouped notice shows the latest message');
begin; select pg_temp.as_user(:B);
insert into chat_reads(user_id, chat_kind, chat_id) values (:B, 'squad', '60000000-0000-0000-0000-000000000003');
update squad_members set muted = true where squad_id = '60000000-0000-0000-0000-000000000003' and user_id = :B;
commit;
select pg_temp.ok((select count(*) from notifications where user_id = :B and kind = 'squad_message' and read_at is null) = 0, 'reading the chat clears its notices');
begin; select pg_temp.as_user(:E);
insert into squad_messages(squad_id, sender_id, body) values ('60000000-0000-0000-0000-000000000003', :E, 'tercero');
commit;
select pg_temp.ok((select count(*) from notifications where user_id = :B and kind = 'squad_message' and read_at is null) = 0, 'muted squads do not notify');
begin; select pg_temp.as_user(:B);
delete from squad_messages where sender_id = :E;
commit;
select pg_temp.ok((select count(*) from squad_messages where sender_id = :E) = 3, 'a member cannot delete messages from others');
begin; select pg_temp.as_user(:E);
delete from squad_messages where sender_id = :B or body = 'tercero';
commit;
select pg_temp.ok((select count(*) from squad_messages where body = 'tercero') = 0, 'owner can delete messages in their squad');
-- DMs between adults A and E
insert into conversations(id, user_low, user_high) values ('61000000-0000-0000-0000-000000000001', :A, :E);
begin; select pg_temp.as_user(:A);
insert into direct_messages(conversation_id, sender_id, body) values ('61000000-0000-0000-0000-000000000001', :A, 'uno'), ('61000000-0000-0000-0000-000000000001', :A, 'dos');
commit;
select pg_temp.ok((select count(*) from notifications where user_id = :E and kind = 'message' and read_at is null) = 1, 'DM notices are grouped per conversation');
select pg_temp.ok((select body from notifications where user_id = :E and kind = 'message') = 'Ana: dos', 'DM notice shows who and what');
begin; select pg_temp.as_user(:E);
insert into chat_reads(user_id, chat_kind, chat_id) values (:E, 'dm', '61000000-0000-0000-0000-000000000001');
commit;
begin; select pg_temp.as_user(:A);
select pg_temp.ok(exists (select 1 from chat_reads where user_id = 'eeeeeeee-0000-0000-0000-0000000000ee'), 'the sender can see the «seen» mark of the chat partner');
delete from direct_messages where body = 'dos';
select pg_temp.denied($$insert into chat_reads(user_id, chat_kind, chat_id) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'squad', '60000000-0000-0000-0000-000000000004')$$, 'cannot mark chats you are not in');
commit;
select pg_temp.ok((select count(*) from direct_messages where body = 'dos') = 0, 'you can delete your own message');
begin; select pg_temp.as_user(:B);
select pg_temp.ok(not exists (select 1 from chat_reads where chat_id = '61000000-0000-0000-0000-000000000001'), 'outsiders cannot see read marks');
rollback;

\echo '--- follows and blocks'
begin; select pg_temp.as_user(:E);
insert into follows(follower_id, followed_id) values (:E, :B);
commit;
begin; select pg_temp.as_user(:B);
insert into follows(follower_id, followed_id) values (:B, :E);
commit;
select pg_temp.ok((select body from notifications where user_id = :B and kind = 'follow' order by created_at desc limit 1) = 'Eva comenzó a seguirte', 'follow notice has the name');
select pg_temp.ok((select body from notifications where user_id = :E and kind = 'follow' order by created_at desc limit 1) like 'Beto también te sigue%', 'mutual follow is celebrated');
begin; select pg_temp.as_user(:B);
insert into blocks(blocker_id, blocked_id) values (:B, :E);
commit;
select pg_temp.ok(not exists (select 1 from follows where (follower_id = :B and followed_id = :E) or (follower_id = :E and followed_id = :B)), 'blocking removes follows both ways');

\echo '--- community quests'
begin; select pg_temp.as_user(:A);
insert into quests(id, creator_id, title) values
 ('62000000-0000-0000-0000-000000000001', :A, 'Reto uno'), ('62000000-0000-0000-0000-000000000002', :A, 'Reto dos'), ('62000000-0000-0000-0000-000000000003', :A, 'Reto tres');
select pg_temp.denied($$insert into quests(creator_id, title) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Reto cuatro')$$, 'max 3 open quests per person');
update quests set title = 'Reto uno editado' where id = '62000000-0000-0000-0000-000000000001';
update quests set ends_at = now() - interval '1 minute' where id = '62000000-0000-0000-0000-000000000003';
insert into quests(creator_id, title) values (:A, 'Reto cuatro');
select pg_temp.ok(true, 'closing a quest frees a slot; the creator can edit');
commit;
begin; select pg_temp.as_user(:B);
update quests set title = 'Robado' where id = '62000000-0000-0000-0000-000000000001';
insert into quest_entries(quest_id, user_id) values ('62000000-0000-0000-0000-000000000001', :B);
update quest_entries set status = 'submitted', proof = 'Ayudé a un novato' where quest_id = '62000000-0000-0000-0000-000000000001' and user_id = :B;
commit;
select pg_temp.ok((select title from quests where id = '62000000-0000-0000-0000-000000000001') = 'Reto uno editado', 'others cannot edit a quest');
select pg_temp.ok((select count(*) from notifications where user_id = :A and kind = 'quest_review') = 1, 'creator is told when evidence arrives');
begin; select pg_temp.as_user(:A);
update quest_entries set status = 'rejected', reviewed_at = now() where quest_id = '62000000-0000-0000-0000-000000000001' and user_id = :B;
commit;
select pg_temp.ok((select count(*) from notifications where user_id = :B and kind = 'quest' and body like 'Te pidieron ajustes%') = 1, 'participant is told to adjust');
begin; select pg_temp.as_user(:B);
delete from quest_entries where quest_id = '62000000-0000-0000-0000-000000000001' and user_id = :B;
commit;
select pg_temp.ok(not exists (select 1 from quest_entries where user_id = :B and quest_id = '62000000-0000-0000-0000-000000000001'), 'a participant can leave a quest');

\echo '--- games, admins and push'
select pg_temp.ok((select steam_appid from games where name = 'Counter-Strike 2') = 730, 'well-known games get their Steam cover id');
begin; select pg_temp.as_user(:A);
update games set image_url = 'https://x/y.png' where name = 'Minecraft';
select pg_temp.ok(not am_i_admin(), 'regular users are not admins');
commit;
select pg_temp.ok((select image_url from games where name = 'Minecraft') is null, 'regular users cannot change game images');
insert into app_admins(user_id) values (:A);
begin; select pg_temp.as_user(:A);
update games set image_url = 'https://x/y.png' where name = 'Minecraft';
select pg_temp.ok(am_i_admin(), 'admin flag');
commit;
select pg_temp.ok((select image_url from games where name = 'Minecraft') = 'https://x/y.png', 'app admins can set game images');
begin; select pg_temp.as_user(:A);
select pg_temp.ok((push_check() ->> 'devices')::int >= 0 and push_check() ? 'pg_net', 'push_check reports status without secrets');
select test_push();
select pg_temp.denied($$select test_push()$$, 'test push is rate limited');
commit;
select pg_temp.ok((select count(*) from notifications where user_id = :A and kind = 'test') = 1, 'test push creates a notice for myself');
\o
\echo 'ALL V11 RLS CHECKS PASSED'
