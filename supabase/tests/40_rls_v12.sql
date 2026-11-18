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
\set M '''a1a1a1a1-0000-0000-0000-0000000000a1'''
\set U '''cccccccc-0000-0000-0000-0000000000cc'''
\set E '''eeeeeeee-0000-0000-0000-0000000000ee'''
insert into auth.users(id, raw_user_meta_data) values ('f0f0f0f0-0000-0000-0000-0000000000f0', '{"display_name":"Fer"}'), ('f1f1f1f1-0000-0000-0000-0000000000f1', '{"display_name":"Gil"}'), ('f2f2f2f2-0000-0000-0000-0000000000f2', '{"display_name":"Hana"}'), ('f3f3f3f3-0000-0000-0000-0000000000f3', '{"display_name":"Ivo"}');
insert into profile_private(user_id, birth_year) values ('f0f0f0f0-0000-0000-0000-0000000000f0', 1995), ('f1f1f1f1-0000-0000-0000-0000000000f1', 1996), ('f2f2f2f2-0000-0000-0000-0000000000f2', 1997), ('f3f3f3f3-0000-0000-0000-0000000000f3', 1998);
\set F '''f0f0f0f0-0000-0000-0000-0000000000f0'''
\set G '''f1f1f1f1-0000-0000-0000-0000000000f1'''
\set H '''f2f2f2f2-0000-0000-0000-0000000000f2'''
\set I '''f3f3f3f3-0000-0000-0000-0000000000f3'''

\echo '--- permisos de funciones internas'
select pg_temp.ok(has_function_privilege('authenticated', 'private.is_squad_staff(uuid)', 'EXECUTE'), 'authenticated can run private.is_squad_staff');
select pg_temp.ok(has_function_privilege('authenticated', 'private.can_schedule(uuid)', 'EXECUTE'), 'authenticated can run private.can_schedule');
select pg_temp.ok(not has_function_privilege('anon', 'private.can_schedule(uuid)', 'EXECUTE'), 'anon cannot run private functions');
begin; select pg_temp.as_user(:F);
select pg_temp.ok((gvq_health() ->> 'grants')::boolean and (gvq_health() ->> 'version') = '12', 'health check reports version 12 and grants ok');
rollback;

\echo '--- retos de comunidad'
insert into communities(id, owner_id, name) values ('70000000-0000-0000-0000-000000000001', :F, 'Comunidad Fer');
insert into community_members(community_id, user_id, role) values ('70000000-0000-0000-0000-000000000001', :G, 'member');
begin; select pg_temp.as_user(:G);
insert into quests(creator_id, community_id, title) values (:G, '70000000-0000-0000-0000-000000000001', 'Reto de Gil');
select pg_temp.ok(true, 'a community member (not staff) can create a challenge');
rollback;
begin; select pg_temp.as_user(:H);
select pg_temp.denied($$insert into quests(creator_id, community_id, title) values ('f2f2f2f2-0000-0000-0000-0000000000f2', '70000000-0000-0000-0000-000000000001', 'Reto ajeno')$$, 'a non-member cannot create challenges in that community');
insert into quests(creator_id, title) values (:H, 'Reto global de Hana');
select pg_temp.ok(true, 'anyone can create a global challenge');
rollback;

\echo '--- agendar partidas en el squad'
begin; select pg_temp.as_user(:F);
insert into squads(id, owner_id, name) values ('71000000-0000-0000-0000-000000000001', :F, 'Squad Fer');
commit;
insert into squad_members(squad_id, user_id, role) values ('71000000-0000-0000-0000-000000000001', :G, 'member');
begin; select pg_temp.as_user(:G);
insert into play_sessions(host_id, squad_id, title, starts_at) values (:G, '71000000-0000-0000-0000-000000000001', 'Partida de Gil', now() + interval '1 day');
select pg_temp.ok(true, 'a squad member can schedule when the owner allows it (default)');
rollback;
update squads set members_can_schedule = false where id = '71000000-0000-0000-0000-000000000001';
begin; select pg_temp.as_user(:G);
select pg_temp.denied($$insert into play_sessions(host_id, squad_id, title, starts_at) values ('f1f1f1f1-0000-0000-0000-0000000000f1', '71000000-0000-0000-0000-000000000001', 'No', now() + interval '1 day')$$, 'members cannot schedule when the owner turns it off');
rollback;
begin; select pg_temp.as_user(:F);
insert into play_sessions(id, host_id, squad_id, title, starts_at) values ('72000000-0000-0000-0000-000000000001', :F, '71000000-0000-0000-0000-000000000001', 'Partida de Fer', now() + interval '1 day');
delete from play_sessions where id = '72000000-0000-0000-0000-000000000001';
select pg_temp.ok(not exists (select 1 from play_sessions where id = '72000000-0000-0000-0000-000000000001'), 'the owner schedules and can delete a match');
rollback;
begin; select pg_temp.as_user(:H);
select pg_temp.denied($$insert into play_sessions(host_id, squad_id, title, starts_at) values ('f2f2f2f2-0000-0000-0000-0000000000f2', '71000000-0000-0000-0000-000000000001', 'Intrusa', now() + interval '1 day')$$, 'outsiders cannot schedule in a squad');
rollback;

\echo '--- mensajes'
begin; select pg_temp.as_user(:F);
select pg_temp.ok(dm_check(:G) = 'ok', 'dm_check ok between adults');
select pg_temp.ok(dm_check(:U) = 'ok', 'v13: adults can message someone without registered age');
select pg_temp.ok(dm_check(:M) = 'age_band', 'dm_check blocks adult -> minor');
insert into conversations(id, user_low, user_high) values ('73000000-0000-0000-0000-000000000001', :F, :G);
insert into direct_messages(id, conversation_id, sender_id, body) values ('73100000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', :F, 'hola gil');
insert into conversation_hides(user_id, conversation_id) values (:F, '73000000-0000-0000-0000-000000000001');
select pg_temp.ok(true, 'hide a chat for me');
select pg_temp.denied($$insert into conversation_hides(user_id, conversation_id) values ('f1f1f1f1-0000-0000-0000-0000000000f1', '73000000-0000-0000-0000-000000000001')$$, 'cannot hide a chat for someone else');
select pg_temp.denied($$insert into direct_messages(conversation_id, sender_id, body) values ('73000000-0000-0000-0000-000000000001', 'f0f0f0f0-0000-0000-0000-0000000000f0', 'Matate ya')$$, 'blocked threat phrase is rejected (accents and case ignored)');
insert into direct_messages(conversation_id, sender_id, body) values ('73000000-0000-0000-0000-000000000001', :F, 'el skyscraper de kysland, te mato en la partida jaja');
select pg_temp.ok(true, 'only whole words or phrases are blocked (no false positives inside other words or gaming banter)');
commit;
begin; select pg_temp.as_user(:H);
select pg_temp.ok(not exists (select 1 from conversation_hides), 'hides are private');
select pg_temp.denied($$insert into reports(reporter_id, reason, target_kind, target_id) values ('f2f2f2f2-0000-0000-0000-0000000000f2', 'acoso', 'dm', '73100000-0000-0000-0000-000000000001')$$, 'cannot report a DM from a chat you are not in');
rollback;
begin; select pg_temp.as_user(:G);
insert into reports(reporter_id, reason, target_kind, target_id) values (:G, 'acoso', 'dm', '73100000-0000-0000-0000-000000000001');
select pg_temp.ok((select snapshot = 'hola gil' and reported_user_id = 'f0f0f0f0-0000-0000-0000-0000000000f0' from reports where target_id = '73100000-0000-0000-0000-000000000001'), 'reporting a DM keeps a copy of the text and the author');
select pg_temp.denied($$insert into reports(reporter_id, reason, target_kind, target_id) values ('f1f1f1f1-0000-0000-0000-0000000000f1', 'acoso', 'dm', '73100000-0000-0000-0000-000000000001')$$, 'duplicate open report is refused');
commit;

\echo '--- silencio automático y administración'
begin; select pg_temp.as_user(:H); insert into reports(reporter_id, reason, target_kind, target_id) values (:H, 'spam', 'user', :F); commit;
begin; select pg_temp.as_user(:I); insert into reports(reporter_id, reason, target_kind, target_id) values (:I, 'acoso', 'user', :F); commit;
select pg_temp.ok(exists (select 1 from suspensions where user_id = 'f0f0f0f0-0000-0000-0000-0000000000f0' and until > now()), '3 reports from different people -> automatic 24 h pause');
begin; select pg_temp.as_user(:F);
select pg_temp.denied($$insert into posts(author_id, body) values ('f0f0f0f0-0000-0000-0000-0000000000f0', 'sigo aqui')$$, 'a paused account cannot post');
select pg_temp.ok(dm_check(:G) = 'suspended', 'dm_check explains the pause');
select pg_temp.ok((gvq_health() ->> 'suspended_until') is not null, 'the paused person sees until when');
select pg_temp.denied($$select admin_unsuspend('f0f0f0f0-0000-0000-0000-0000000000f0')$$, 'nobody lifts their own pause');
rollback;
begin; select pg_temp.as_user(:G);
select pg_temp.ok((select count(*) from reports) = 1, 'people only see their own reports');
select pg_temp.denied($$select admin_stats()$$, 'non-admins cannot open the admin panel data');
select pg_temp.denied($$select admin_suspend('f2f2f2f2-0000-0000-0000-0000000000f2', 24, 'x')$$, 'non-admins cannot suspend');
rollback;
insert into app_admins(user_id) values (:E) on conflict do nothing;
begin; select pg_temp.as_user(:E);
select pg_temp.ok((select count(*) from reports where status = 'open') >= 3, 'admins see all open reports');
select pg_temp.ok((admin_stats() ->> 'open_reports')::int >= 3, 'admin stats work');
select admin_unsuspend(:F);
select pg_temp.ok(not exists (select 1 from suspensions where user_id = 'f0f0f0f0-0000-0000-0000-0000000000f0'), 'admin lifts a pause');
select admin_suspend(:H, 48, 'Insultos');
select pg_temp.ok(exists (select 1 from suspensions where user_id = 'f2f2f2f2-0000-0000-0000-0000000000f2'), 'admin suspends 48 h');
select admin_word('Basura humana', true);
select pg_temp.ok(exists (select 1 from blocked_words where word = 'basura humana'), 'admin adds a blocked phrase');
select admin_delete('dm', '73100000-0000-0000-0000-000000000001', 'Acoso');
select pg_temp.ok(not exists (select 1 from direct_messages where id = '73100000-0000-0000-0000-000000000001'), 'admin deletes a reported message');
select pg_temp.ok((select count(*) from mod_log) >= 4, 'every admin action is logged');
commit;
begin; select pg_temp.as_user(:G);
select pg_temp.denied($$insert into posts(author_id, body) values ('f1f1f1f1-0000-0000-0000-0000000000f1', 'eres una BASURA humana')$$, 'new blocked phrase applies immediately');
select pg_temp.ok(not exists (select 1 from blocked_words), 'only admins read the word list');
rollback;

\echo '--- música y encuestas del squad'
begin; select pg_temp.as_user(:G);
insert into squad_tracks(id, squad_id, user_id, title, artist) values ('74000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', :G, 'Lofi Night', 'Chill Beats');
insert into track_likes(track_id, user_id) values ('74000000-0000-0000-0000-000000000001', :G);
insert into squad_polls(id, squad_id, creator_id, question, options) values ('75000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', :G, '¿A qué jugamos?', '["Valorant","Minecraft"]');
insert into squad_poll_votes(poll_id, user_id, choice) values ('75000000-0000-0000-0000-000000000001', :G, 1);
update squad_poll_votes set choice = 0 where poll_id = '75000000-0000-0000-0000-000000000001' and user_id = 'f1f1f1f1-0000-0000-0000-0000000000f1';
select pg_temp.ok(true, 'members share songs, like them, open polls and change their vote');
select pg_temp.denied($$insert into squad_poll_votes(poll_id, user_id, choice) values ('75000000-0000-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-0000000000f1', 4)$$, 'cannot vote an option that does not exist');
select pg_temp.denied($$insert into squad_tracks(squad_id, user_id, title, artist, link_url) values ('71000000-0000-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-0000000000f1', 'x', 'y', 'javascript:alert(1)')$$, 'links must be https');
commit;
select pg_temp.ok(exists (select 1 from notifications where user_id = 'f0f0f0f0-0000-0000-0000-0000000000f0' and kind = 'squad_message' and body like '%🎵%' or body like '%encuesta%'), 'the squad gets a notice');
begin; select pg_temp.as_user(:H);
select pg_temp.ok(not exists (select 1 from squad_tracks) and not exists (select 1 from squad_polls), 'outsiders do not see the squad music or polls');
select pg_temp.denied($$insert into squad_tracks(squad_id, user_id, title, artist) values ('71000000-0000-0000-0000-000000000001', 'f2f2f2f2-0000-0000-0000-0000000000f2', 'x', 'y')$$, 'outsiders cannot share songs');
rollback;
begin; select pg_temp.as_user(:F);
delete from squad_tracks where id = '74000000-0000-0000-0000-000000000001';
select pg_temp.ok(not exists (select 1 from squad_tracks where id = '74000000-0000-0000-0000-000000000001'), 'the owner can remove any song');
rollback;

\echo '--- comunidades'
begin; select pg_temp.as_user(:F);
select set_community_role('70000000-0000-0000-0000-000000000001', :G, 'moderator');
select pg_temp.ok((select role from community_members where user_id = 'f1f1f1f1-0000-0000-0000-0000000000f1' and community_id = '70000000-0000-0000-0000-000000000001') = 'moderator', 'the owner names a moderator');
rollback;
insert into community_members(community_id, user_id, role) values ('70000000-0000-0000-0000-000000000001', :I, 'member');
begin; select pg_temp.as_user(:F);
delete from community_members where community_id = '70000000-0000-0000-0000-000000000001' and user_id = 'f3f3f3f3-0000-0000-0000-0000000000f3';
select pg_temp.ok(not exists (select 1 from community_members where user_id = 'f3f3f3f3-0000-0000-0000-0000000000f3' and community_id = '70000000-0000-0000-0000-000000000001'), 'staff can remove a member');
rollback;
begin; select pg_temp.as_user(:G);
select pg_temp.denied($$select set_community_role('70000000-0000-0000-0000-000000000001', 'f3f3f3f3-0000-0000-0000-0000000000f3', 'moderator')$$, 'only the owner names moderators');
update profiles set companion = '{"eyes":"visor","color":"crimson"}' where id = 'f1f1f1f1-0000-0000-0000-0000000000f1';
select pg_temp.ok((select companion ->> 'eyes' from profiles where id = 'f1f1f1f1-0000-0000-0000-0000000000f1') = 'visor', 'companion look is saved in the profile');
rollback;
\o
\echo 'ALL V12 RLS CHECKS PASSED'
