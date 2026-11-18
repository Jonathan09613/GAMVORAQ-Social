-- GAMVORAQ · Diagnóstico: lee cada tabla COMO si fueras tú desde la app.
-- Cambia el correo si hace falta y presiona Run. Mándame captura del resultado.
create or replace function pg_temp.gvq_diag(uid uuid) returns table(tabla text, resultado text) language plpgsql as $$
declare t text; n int;
begin
  if uid is null then tabla := 'ERROR'; resultado := 'No existe una cuenta con ese correo'; return next; return; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  foreach t in array array['profiles','games','user_games','communities','community_members','posts','post_images','comments','post_reactions',
    'channels','channel_messages','gallery','follows','blocks','conversations','direct_messages','squads','squad_members','squad_messages',
    'quests','quest_entries','badges','notifications','reports','squad_memories','memory_consents','availability','play_sessions','session_rsvps',
    'chemistry_ratings','profile_private','guide_offers','guide_requests','waves','leagues','league_teams','league_matches','family_links',
    'conduct_strikes','squad_invites','chat_reads','conversation_hides','squad_tracks','track_likes','squad_polls','squad_poll_votes',
    'suspensions','blocked_words','mod_log'] loop
    begin
      execute format('select count(*) from (select * from public.%I limit 3000) x', t) into n;
      tabla := t; resultado := '✓ ' || n || ' filas';
    exception when others then tabla := t; resultado := '✗ ' || sqlerrm;
    end;
    return next;
  end loop;
end $$;
select * from pg_temp.gvq_diag((select id from auth.users where email = 'deividmora93@gmail.com')) order by left(resultado, 1) desc, tabla;
