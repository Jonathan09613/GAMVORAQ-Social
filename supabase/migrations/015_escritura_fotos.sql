-- GAMVORAQ · 015 · Reglas de ESCRITURA, recuerdos, mensajes de squad y fotos de squads/comunidades.
-- 1) Igual que la 013 hizo con la lectura, revisa las reglas para CREAR, EDITAR y BORRAR en todas las tablas
--    de la app: si a una tabla le falta la regla para una acción, pone la oficial de GAMVORAQ.
--    Quita también las reglas RESTRICTIVAS (GAMVORAQ no usa ninguna). No cambia las reglas que ya existen.
-- 2) Recuerdos: arregla la regla de lectura que impedía guardarlos («new row violates… squad_memories»).
-- 3) Mensajes y recuerdos del squad pasan por funciones del servidor que validan que seas integrante.
-- 4) Foto de perfil para squads y comunidades.
-- Se puede ejecutar varias veces. Al final muestra lo que se reparó.
BEGIN;
CREATE TABLE IF NOT EXISTS public._gvq_policy_backup AS SELECT now() AS saved_at, * FROM pg_policies WHERE false;
ALTER TABLE public._gvq_policy_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._gvq_policy_backup FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS public._gvq_repair_log (at timestamptz DEFAULT now(), tabla text, accion text);
ALTER TABLE public._gvq_repair_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._gvq_repair_log FROM anon, authenticated;
DELETE FROM public._gvq_repair_log;
INSERT INTO public._gvq_policy_backup SELECT now(), * FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('availability', 'blocks', 'channel_messages', 'channels', 'chat_reads', 'chemistry_ratings', 'chronicle_options', 'chronicle_votes', 'chronicles', 'comments', 'communities', 'community_members', 'conversations', 'direct_messages', 'family_links', 'follows', 'gallery', 'games', 'guide_offers', 'guide_requests', 'league_matches', 'league_teams', 'leagues', 'memory_consents', 'notifications', 'play_sessions', 'post_images', 'post_reactions', 'posts', 'profile_private', 'profiles', 'pulse_members', 'pulse_messages', 'pulse_rooms', 'quest_entries', 'quests', 'reports', 'session_rsvps', 'squad_invites', 'squad_members', 'squad_memories', 'squad_messages', 'squad_poll_votes', 'squad_polls', 'squad_tracks', 'squads', 'track_likes', 'universe_portals', 'universe_spaces', 'user_games', 'waves');

-- ═════ 1 · Reglas restrictivas fuera (todas las acciones) ═════
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND permissive = 'RESTRICTIVE' AND tablename IN ('availability', 'blocks', 'channel_messages', 'channels', 'chat_reads', 'chemistry_ratings', 'chronicle_options', 'chronicle_votes', 'chronicles', 'comments', 'communities', 'community_members', 'conversations', 'direct_messages', 'family_links', 'follows', 'gallery', 'games', 'guide_offers', 'guide_requests', 'league_matches', 'league_teams', 'leagues', 'memory_consents', 'notifications', 'play_sessions', 'post_images', 'post_reactions', 'posts', 'profile_private', 'profiles', 'pulse_members', 'pulse_messages', 'pulse_rooms', 'quest_entries', 'quests', 'reports', 'session_rsvps', 'squad_invites', 'squad_members', 'squad_memories', 'squad_messages', 'squad_poll_votes', 'squad_polls', 'squad_tracks', 'squads', 'track_likes', 'universe_portals', 'universe_spaces', 'user_games', 'waves') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES (p.tablename, 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
END $$;

-- ═════ 2 · Reglas de escritura que falten ═════
DO $$ BEGIN
  IF to_regclass('public.availability') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'availability' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.availability', 'availability_clear'); EXECUTE 'CREATE POLICY "availability_clear" ON public.availability FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('availability', 'puesta la regla DELETE availability_clear');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('availability', '✗ no se pudo poner availability_clear: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.availability') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'availability' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.availability', 'availability_set'); EXECUTE 'CREATE POLICY "availability_set" ON public.availability FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('availability', 'puesta la regla INSERT availability_set');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('availability', '✗ no se pudo poner availability_set: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.availability') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'availability' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.availability', 'availability_edit'); EXECUTE 'CREATE POLICY "availability_edit" ON public.availability FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('availability', 'puesta la regla UPDATE availability_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('availability', '✗ no se pudo poner availability_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.blocks') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocks' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.blocks', 'blocks_remove'); EXECUTE 'CREATE POLICY "blocks_remove" ON public.blocks FOR DELETE TO authenticated USING (blocker_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('blocks', 'puesta la regla DELETE blocks_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('blocks', '✗ no se pudo poner blocks_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.blocks') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocks' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.blocks', 'blocks_add'); EXECUTE 'CREATE POLICY "blocks_add" ON public.blocks FOR INSERT TO authenticated WITH CHECK (blocker_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('blocks', 'puesta la regla INSERT blocks_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('blocks', '✗ no se pudo poner blocks_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.channel_messages') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'channel_messages' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.channel_messages', 'channel_msgs_add'); EXECUTE 'CREATE POLICY "channel_msgs_add" ON public.channel_messages FOR INSERT TO authenticated WITH CHECK (author_id=(select auth.uid()) and exists(select 1 from public.channels ch where ch.id=channel_id and public.is_community_staff(ch.community_id)))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('channel_messages', 'puesta la regla INSERT channel_msgs_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('channel_messages', '✗ no se pudo poner channel_msgs_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.channels') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'channels' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.channels', 'channels_add'); EXECUTE 'CREATE POLICY "channels_add" ON public.channels FOR INSERT TO authenticated WITH CHECK (created_by=(select auth.uid()) and public.is_community_staff(community_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('channels', 'puesta la regla INSERT channels_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('channels', '✗ no se pudo poner channels_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.chat_reads') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_reads' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_reads', 'chat_reads_write'); EXECUTE 'CREATE POLICY "chat_reads_write" ON public.chat_reads FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND ((chat_kind = ''dm'' AND public.is_conversation_member(chat_id)) OR (chat_kind = ''squad'' AND public.is_squad_member(chat_id))))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chat_reads', 'puesta la regla INSERT chat_reads_write');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chat_reads', '✗ no se pudo poner chat_reads_write: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.chat_reads') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_reads' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_reads', 'chat_reads_update'); EXECUTE 'CREATE POLICY "chat_reads_update" ON public.chat_reads FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chat_reads', 'puesta la regla UPDATE chat_reads_update');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chat_reads', '✗ no se pudo poner chat_reads_update: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.chemistry_ratings') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chemistry_ratings' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.chemistry_ratings', 'chemistry_rate'); EXECUTE 'CREATE POLICY "chemistry_rate" ON public.chemistry_ratings FOR INSERT TO authenticated WITH CHECK (
  rater_id = (SELECT auth.uid()) AND private.can_rate(session_id, rater_id, ratee_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chemistry_ratings', 'puesta la regla INSERT chemistry_rate');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chemistry_ratings', '✗ no se pudo poner chemistry_rate: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.chronicle_options') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chronicle_options' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.chronicle_options', 'options_insert'); EXECUTE 'CREATE POLICY "options_insert" ON public.chronicle_options FOR INSERT TO authenticated WITH CHECK (
 EXISTS(SELECT 1 FROM public.chronicles c WHERE c.id=chronicle_id AND private.is_community_staff(c.community_id)
 AND (chapter_no=c.chapter_no OR (c.status=''closed'' AND chapter_no=c.chapter_no+1))))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicle_options', 'puesta la regla INSERT options_insert');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicle_options', '✗ no se pudo poner options_insert: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.chronicle_votes') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chronicle_votes' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.chronicle_votes', 'votes_insert'); EXECUTE 'CREATE POLICY "votes_insert" ON public.chronicle_votes FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()) AND
 EXISTS(SELECT 1 FROM public.chronicles c WHERE c.id=chronicle_id AND c.chapter_no=chronicle_votes.chapter_no AND c.status=''open''
 AND private.is_community_member(c.community_id)))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicle_votes', 'puesta la regla INSERT votes_insert');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicle_votes', '✗ no se pudo poner votes_insert: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.chronicles') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chronicles' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.chronicles', 'chronicles_insert'); EXECUTE 'CREATE POLICY "chronicles_insert" ON public.chronicles FOR INSERT TO authenticated WITH CHECK (creator_id=(SELECT auth.uid()) AND private.is_community_staff(community_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicles', 'puesta la regla INSERT chronicles_insert');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicles', '✗ no se pudo poner chronicles_insert: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.chronicles') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chronicles' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.chronicles', 'chronicles_update'); EXECUTE 'CREATE POLICY "chronicles_update" ON public.chronicles FOR UPDATE TO authenticated USING (private.is_community_staff(community_id)) WITH CHECK (private.is_community_staff(community_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicles', 'puesta la regla UPDATE chronicles_update');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicles', '✗ no se pudo poner chronicles_update: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.comments') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'comments' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.comments', 'comments_delete'); EXECUTE 'CREATE POLICY "comments_delete" ON public.comments FOR DELETE TO authenticated USING (author_id=(select auth.uid()) or exists(select 1 from public.posts p where p.id=post_id and p.community_id is not null and public.is_community_staff(p.community_id)))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('comments', 'puesta la regla DELETE comments_delete');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('comments', '✗ no se pudo poner comments_delete: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.comments') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'comments' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.comments', 'comments_add'); EXECUTE 'CREATE POLICY "comments_add" ON public.comments FOR INSERT TO authenticated WITH CHECK (author_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('comments', 'puesta la regla INSERT comments_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('comments', '✗ no se pudo poner comments_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.communities') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communities' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.communities', 'communities_delete'); EXECUTE 'CREATE POLICY "communities_delete" ON public.communities FOR DELETE TO authenticated USING (owner_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('communities', 'puesta la regla DELETE communities_delete');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('communities', '✗ no se pudo poner communities_delete: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.communities') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communities' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.communities', 'communities_add'); EXECUTE 'CREATE POLICY "communities_add" ON public.communities FOR INSERT TO authenticated WITH CHECK (owner_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('communities', 'puesta la regla INSERT communities_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('communities', '✗ no se pudo poner communities_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.communities') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communities' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.communities', 'communities_update'); EXECUTE 'CREATE POLICY "communities_update" ON public.communities FOR UPDATE TO authenticated USING (owner_id=(select auth.uid())) WITH CHECK (owner_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('communities', 'puesta la regla UPDATE communities_update');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('communities', '✗ no se pudo poner communities_update: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.community_members') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_members' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.community_members', 'members_leave'); EXECUTE 'CREATE POLICY "members_leave" ON public.community_members FOR DELETE TO authenticated USING (user_id=(select auth.uid()) and role=''member'')';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('community_members', 'puesta la regla DELETE members_leave');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('community_members', '✗ no se pudo poner members_leave: ' || SQLERRM); END;
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.community_members', 'members_kick'); EXECUTE 'CREATE POLICY "members_kick" ON public.community_members FOR DELETE TO authenticated USING (
  role = ''member'' AND public.is_community_staff(community_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('community_members', 'puesta la regla DELETE members_kick');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('community_members', '✗ no se pudo poner members_kick: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.community_members') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_members' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.community_members', 'members_join'); EXECUTE 'CREATE POLICY "members_join" ON public.community_members FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()) and role=''member'')';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('community_members', 'puesta la regla INSERT members_join');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('community_members', '✗ no se pudo poner members_join: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.conversations') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversations', 'conversations_create'); EXECUTE 'CREATE POLICY "conversations_create" ON public.conversations FOR INSERT TO authenticated WITH CHECK (
  (user_low = (SELECT auth.uid()) OR user_high = (SELECT auth.uid()))
  AND public.is_not_blocked(CASE WHEN user_low = (SELECT auth.uid()) THEN user_high ELSE user_low END)
  AND private.can_interact(user_low, user_high))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('conversations', 'puesta la regla INSERT conversations_create');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('conversations', '✗ no se pudo poner conversations_create: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.direct_messages') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'direct_messages' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.direct_messages', 'dms_delete_own'); EXECUTE 'CREATE POLICY "dms_delete_own" ON public.direct_messages FOR DELETE TO authenticated USING (sender_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('direct_messages', 'puesta la regla DELETE dms_delete_own');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('direct_messages', '✗ no se pudo poner dms_delete_own: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.direct_messages') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'direct_messages' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.direct_messages', 'dms_send'); EXECUTE 'CREATE POLICY "dms_send" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = (SELECT auth.uid()) AND public.is_conversation_member(conversation_id)
  AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
              AND public.is_not_blocked(CASE WHEN c.user_low = (SELECT auth.uid()) THEN c.user_high ELSE c.user_low END)
              AND private.can_interact(c.user_low, c.user_high)))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('direct_messages', 'puesta la regla INSERT dms_send');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('direct_messages', '✗ no se pudo poner dms_send: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.family_links') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'family_links' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.family_links', 'family_remove'); EXECUTE 'CREATE POLICY "family_remove" ON public.family_links FOR DELETE TO authenticated USING (guardian_id = (SELECT auth.uid()) OR minor_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('family_links', 'puesta la regla DELETE family_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('family_links', '✗ no se pudo poner family_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.family_links') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'family_links' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.family_links', 'family_request'); EXECUTE 'CREATE POLICY "family_request" ON public.family_links FOR INSERT TO authenticated WITH CHECK (
  guardian_id = (SELECT auth.uid()) AND status = ''pending''
  AND private.age_band(guardian_id) = ''adult'' AND private.age_band(minor_id) = ''minor'')';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('family_links', 'puesta la regla INSERT family_request');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('family_links', '✗ no se pudo poner family_request: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.family_links') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'family_links' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.family_links', 'family_accept'); EXECUTE 'CREATE POLICY "family_accept" ON public.family_links FOR UPDATE TO authenticated USING (minor_id = (SELECT auth.uid())) WITH CHECK (minor_id = (SELECT auth.uid()) AND status = ''accepted'')';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('family_links', 'puesta la regla UPDATE family_accept');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('family_links', '✗ no se pudo poner family_accept: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.follows') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'follows' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.follows', 'follows_remove'); EXECUTE 'CREATE POLICY "follows_remove" ON public.follows FOR DELETE TO authenticated USING (follower_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('follows', 'puesta la regla DELETE follows_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('follows', '✗ no se pudo poner follows_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.follows') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'follows' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.follows', 'follows_add'); EXECUTE 'CREATE POLICY "follows_add" ON public.follows FOR INSERT TO authenticated WITH CHECK (
  follower_id = (SELECT auth.uid()) AND followed_id <> follower_id AND public.is_not_blocked(followed_id)
  AND (private.age_band(followed_id) <> ''minor'' OR private.age_band(follower_id) = ''minor''))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('follows', 'puesta la regla INSERT follows_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('follows', '✗ no se pudo poner follows_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.gallery') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gallery' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.gallery', 'gallery_delete'); EXECUTE 'CREATE POLICY "gallery_delete" ON public.gallery FOR DELETE TO authenticated USING (user_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('gallery', 'puesta la regla DELETE gallery_delete');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('gallery', '✗ no se pudo poner gallery_delete: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.gallery') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gallery' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.gallery', 'gallery_add'); EXECUTE 'CREATE POLICY "gallery_add" ON public.gallery FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('gallery', 'puesta la regla INSERT gallery_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('gallery', '✗ no se pudo poner gallery_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.games') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'games' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.games', 'games_admin_add'); EXECUTE 'CREATE POLICY "games_admin_add" ON public.games FOR INSERT TO authenticated WITH CHECK (private.is_app_admin())';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('games', 'puesta la regla INSERT games_admin_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('games', '✗ no se pudo poner games_admin_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.games') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'games' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.games', 'games_admin_edit'); EXECUTE 'CREATE POLICY "games_admin_edit" ON public.games FOR UPDATE TO authenticated USING (private.is_app_admin()) WITH CHECK (private.is_app_admin())';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('games', 'puesta la regla UPDATE games_admin_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('games', '✗ no se pudo poner games_admin_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.guide_offers') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guide_offers' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.guide_offers', 'guide_offers_remove'); EXECUTE 'CREATE POLICY "guide_offers_remove" ON public.guide_offers FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_offers', 'puesta la regla DELETE guide_offers_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_offers', '✗ no se pudo poner guide_offers_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.guide_offers') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guide_offers' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.guide_offers', 'guide_offers_add'); EXECUTE 'CREATE POLICY "guide_offers_add" ON public.guide_offers FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.user_games g WHERE g.user_id = (SELECT auth.uid()) AND g.game_id = guide_offers.game_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_offers', 'puesta la regla INSERT guide_offers_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_offers', '✗ no se pudo poner guide_offers_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.guide_offers') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guide_offers' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.guide_offers', 'guide_offers_edit'); EXECUTE 'CREATE POLICY "guide_offers_edit" ON public.guide_offers FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_offers', 'puesta la regla UPDATE guide_offers_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_offers', '✗ no se pudo poner guide_offers_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.guide_requests') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guide_requests' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.guide_requests', 'guide_requests_add'); EXECUTE 'CREATE POLICY "guide_requests_add" ON public.guide_requests FOR INSERT TO authenticated WITH CHECK (
  learner_id = (SELECT auth.uid()) AND status = ''pending'' AND helpful IS NULL
  AND EXISTS (SELECT 1 FROM public.guide_offers o WHERE o.user_id = guide_id AND o.game_id = guide_requests.game_id)
  AND public.is_not_blocked(guide_id) AND private.can_interact(guide_id, learner_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_requests', 'puesta la regla INSERT guide_requests_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_requests', '✗ no se pudo poner guide_requests_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.guide_requests') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guide_requests' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.guide_requests', 'guide_requests_edit'); EXECUTE 'CREATE POLICY "guide_requests_edit" ON public.guide_requests FOR UPDATE TO authenticated USING (
  guide_id = (SELECT auth.uid()) OR learner_id = (SELECT auth.uid())) WITH CHECK (guide_id = (SELECT auth.uid()) OR learner_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_requests', 'puesta la regla UPDATE guide_requests_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_requests', '✗ no se pudo poner guide_requests_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.league_matches') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'league_matches' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_matches', 'league_matches_remove'); EXECUTE 'CREATE POLICY "league_matches_remove" ON public.league_matches FOR DELETE TO authenticated USING (private.is_league_owner(league_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_matches', 'puesta la regla DELETE league_matches_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_matches', '✗ no se pudo poner league_matches_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.league_matches') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'league_matches' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_matches', 'league_matches_add'); EXECUTE 'CREATE POLICY "league_matches_add" ON public.league_matches FOR INSERT TO authenticated WITH CHECK (private.is_league_owner(league_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_matches', 'puesta la regla INSERT league_matches_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_matches', '✗ no se pudo poner league_matches_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.league_matches') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'league_matches' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_matches', 'league_matches_edit'); EXECUTE 'CREATE POLICY "league_matches_edit" ON public.league_matches FOR UPDATE TO authenticated USING (private.is_league_owner(league_id)) WITH CHECK (private.is_league_owner(league_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_matches', 'puesta la regla UPDATE league_matches_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_matches', '✗ no se pudo poner league_matches_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.league_teams') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'league_teams' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_teams', 'league_teams_remove'); EXECUTE 'CREATE POLICY "league_teams_remove" ON public.league_teams FOR DELETE TO authenticated USING (
  (private.is_squad_owner(squad_id) OR private.is_league_owner(league_id))
  AND EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.status = ''inscripciones''))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_teams', 'puesta la regla DELETE league_teams_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_teams', '✗ no se pudo poner league_teams_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.league_teams') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'league_teams' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_teams', 'league_teams_add'); EXECUTE 'CREATE POLICY "league_teams_add" ON public.league_teams FOR INSERT TO authenticated WITH CHECK (
  registered_by = (SELECT auth.uid()) AND private.is_squad_staff(squad_id)
  AND EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.status = ''inscripciones''))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_teams', 'puesta la regla INSERT league_teams_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_teams', '✗ no se pudo poner league_teams_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.leagues') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leagues' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.leagues', 'leagues_remove'); EXECUTE 'CREATE POLICY "leagues_remove" ON public.leagues FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('leagues', 'puesta la regla DELETE leagues_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('leagues', '✗ no se pudo poner leagues_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.leagues') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leagues' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.leagues', 'leagues_add'); EXECUTE 'CREATE POLICY "leagues_add" ON public.leagues FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()) AND status = ''inscripciones'')';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('leagues', 'puesta la regla INSERT leagues_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('leagues', '✗ no se pudo poner leagues_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.leagues') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leagues' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.leagues', 'leagues_edit'); EXECUTE 'CREATE POLICY "leagues_edit" ON public.leagues FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('leagues', 'puesta la regla UPDATE leagues_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('leagues', '✗ no se pudo poner leagues_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.memory_consents') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'memory_consents' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.memory_consents', 'consents_create'); EXECUTE 'CREATE POLICY "consents_create" ON public.memory_consents FOR INSERT TO authenticated WITH CHECK (
 status=''pending'' AND EXISTS(SELECT 1 FROM public.squad_memories m WHERE m.id=memory_id AND m.author_id=(SELECT auth.uid()) AND m.author_id<>user_id
 AND EXISTS(SELECT 1 FROM public.squad_members sm WHERE sm.squad_id=m.squad_id AND sm.user_id=memory_consents.user_id)))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('memory_consents', 'puesta la regla INSERT consents_create');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('memory_consents', '✗ no se pudo poner consents_create: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.memory_consents') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'memory_consents' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.memory_consents', 'consents_vote'); EXECUTE 'CREATE POLICY "consents_vote" ON public.memory_consents FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid()) AND status=''pending'') WITH CHECK (user_id=(SELECT auth.uid()) AND status IN (''approved'',''declined''))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('memory_consents', 'puesta la regla UPDATE consents_vote');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('memory_consents', '✗ no se pudo poner consents_vote: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.notifications') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', 'notifications_ack'); EXECUTE 'CREATE POLICY "notifications_ack" ON public.notifications FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('notifications', 'puesta la regla UPDATE notifications_ack');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('notifications', '✗ no se pudo poner notifications_ack: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.play_sessions') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'play_sessions' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.play_sessions', 'sessions_delete'); EXECUTE 'CREATE POLICY "sessions_delete" ON public.play_sessions FOR DELETE TO authenticated USING (
  host_id = (SELECT auth.uid()) OR (squad_id IS NOT NULL AND private.is_squad_staff(squad_id)))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('play_sessions', 'puesta la regla DELETE sessions_delete');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('play_sessions', '✗ no se pudo poner sessions_delete: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.play_sessions') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'play_sessions' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.play_sessions', 'sessions_add'); EXECUTE 'CREATE POLICY "sessions_add" ON public.play_sessions FOR INSERT TO authenticated WITH CHECK (
  host_id = (SELECT auth.uid()) AND status = ''scheduled''
  AND starts_at > now() - interval ''10 minutes'' AND starts_at < now() + interval ''60 days''
  AND (squad_id IS NULL OR private.can_schedule(squad_id))
  AND (squad_id IS NOT NULL OR NOT private.has_open_strike((SELECT auth.uid()))))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('play_sessions', 'puesta la regla INSERT sessions_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('play_sessions', '✗ no se pudo poner sessions_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.play_sessions') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'play_sessions' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.play_sessions', 'sessions_edit'); EXECUTE 'CREATE POLICY "sessions_edit" ON public.play_sessions FOR UPDATE TO authenticated USING (host_id = (SELECT auth.uid()) OR (squad_id IS NOT NULL AND private.is_squad_staff(squad_id))) WITH CHECK (host_id = (SELECT auth.uid()) OR (squad_id IS NOT NULL AND private.is_squad_staff(squad_id)))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('play_sessions', 'puesta la regla UPDATE sessions_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('play_sessions', '✗ no se pudo poner sessions_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.post_images') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_images' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_images', 'images_delete'); EXECUTE 'CREATE POLICY "images_delete" ON public.post_images FOR DELETE TO authenticated USING (exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid())))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_images', 'puesta la regla DELETE images_delete');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_images', '✗ no se pudo poner images_delete: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.post_images') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_images' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_images', 'images_add'); EXECUTE 'CREATE POLICY "images_add" ON public.post_images FOR INSERT TO authenticated WITH CHECK (exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid())))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_images', 'puesta la regla INSERT images_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_images', '✗ no se pudo poner images_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.post_reactions') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_reactions' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_reactions', 'reactions_remove'); EXECUTE 'CREATE POLICY "reactions_remove" ON public.post_reactions FOR DELETE TO authenticated USING (user_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_reactions', 'puesta la regla DELETE reactions_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_reactions', '✗ no se pudo poner reactions_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.post_reactions') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_reactions' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_reactions', 'reactions_add'); EXECUTE 'CREATE POLICY "reactions_add" ON public.post_reactions FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_reactions', 'puesta la regla INSERT reactions_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_reactions', '✗ no se pudo poner reactions_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.post_reactions') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_reactions' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_reactions', 'reactions_edit'); EXECUTE 'CREATE POLICY "reactions_edit" ON public.post_reactions FOR UPDATE TO authenticated USING (user_id=(select auth.uid())) WITH CHECK (user_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_reactions', 'puesta la regla UPDATE reactions_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_reactions', '✗ no se pudo poner reactions_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.posts') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.posts', 'posts_delete'); EXECUTE 'CREATE POLICY "posts_delete" ON public.posts FOR DELETE TO authenticated USING (author_id=(select auth.uid()) or (community_id is not null and public.is_community_staff(community_id)))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('posts', 'puesta la regla DELETE posts_delete');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('posts', '✗ no se pudo poner posts_delete: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.posts') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.posts', 'posts_add'); EXECUTE 'CREATE POLICY "posts_add" ON public.posts FOR INSERT TO authenticated WITH CHECK (author_id=(select auth.uid()) and (community_id is null or exists(select 1 from public.community_members where community_id=posts.community_id and user_id=(select auth.uid()))))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('posts', 'puesta la regla INSERT posts_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('posts', '✗ no se pudo poner posts_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.posts') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.posts', 'posts_update'); EXECUTE 'CREATE POLICY "posts_update" ON public.posts FOR UPDATE TO authenticated USING (author_id=(select auth.uid())) WITH CHECK (author_id=(select auth.uid()) and (community_id is null or exists(select 1 from public.community_members where community_id=posts.community_id and user_id=(select auth.uid()))))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('posts', 'puesta la regla UPDATE posts_update');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('posts', '✗ no se pudo poner posts_update: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.profile_private') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_private' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.profile_private', 'private_self_add'); EXECUTE 'CREATE POLICY "private_self_add" ON public.profile_private FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profile_private', 'puesta la regla INSERT private_self_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profile_private', '✗ no se pudo poner private_self_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.profile_private') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_private' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.profile_private', 'private_self_edit'); EXECUTE 'CREATE POLICY "private_self_edit" ON public.profile_private FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profile_private', 'puesta la regla UPDATE private_self_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profile_private', '✗ no se pudo poner private_self_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.profiles') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', 'profiles_update'); EXECUTE 'CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (id=(select auth.uid())) WITH CHECK (id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profiles', 'puesta la regla UPDATE profiles_update');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profiles', '✗ no se pudo poner profiles_update: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.pulse_members') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pulse_members' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.pulse_members', 'pulse_members_leave'); EXECUTE 'CREATE POLICY "pulse_members_leave" ON public.pulse_members FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_members', 'puesta la regla DELETE pulse_members_leave');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_members', '✗ no se pudo poner pulse_members_leave: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.pulse_members') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pulse_members' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.pulse_members', 'pulse_members_join'); EXECUTE 'CREATE POLICY "pulse_members_join" ON public.pulse_members FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()) AND private.pulse_visible(room_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_members', 'puesta la regla INSERT pulse_members_join');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_members', '✗ no se pudo poner pulse_members_join: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.pulse_messages') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pulse_messages' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.pulse_messages', 'pulse_messages_send'); EXECUTE 'CREATE POLICY "pulse_messages_send" ON public.pulse_messages FOR INSERT TO authenticated WITH CHECK (sender_id=(SELECT auth.uid()) AND private.is_pulse_member(room_id) AND EXISTS(SELECT 1 FROM public.pulse_rooms r WHERE r.id=room_id AND r.status=''open'' AND r.expires_at>now()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_messages', 'puesta la regla INSERT pulse_messages_send');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_messages', '✗ no se pudo poner pulse_messages_send: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.pulse_rooms') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pulse_rooms' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.pulse_rooms', 'pulse_create'); EXECUTE 'CREATE POLICY "pulse_create" ON public.pulse_rooms FOR INSERT TO authenticated WITH CHECK (
 host_id=(SELECT auth.uid()) AND status=''open'' AND expires_at>now() AND expires_at<=now()+interval ''4 hours'' AND
 (visibility=''public'' OR (visibility=''community'' AND private.is_community_member(community_id)) OR (visibility=''squad'' AND private.is_squad_member(squad_id))))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_rooms', 'puesta la regla INSERT pulse_create');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_rooms', '✗ no se pudo poner pulse_create: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.pulse_rooms') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pulse_rooms' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.pulse_rooms', 'pulse_close'); EXECUTE 'CREATE POLICY "pulse_close" ON public.pulse_rooms FOR UPDATE TO authenticated USING (host_id=(SELECT auth.uid())) WITH CHECK (host_id=(SELECT auth.uid()) AND status=''closed'')';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_rooms', 'puesta la regla UPDATE pulse_close');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_rooms', '✗ no se pudo poner pulse_close: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.quest_entries') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quest_entries' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.quest_entries', 'quest_entries_leave'); EXECUTE 'CREATE POLICY "quest_entries_leave" ON public.quest_entries FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()) AND status IN (''joined'', ''rejected'', ''submitted''))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quest_entries', 'puesta la regla DELETE quest_entries_leave');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quest_entries', '✗ no se pudo poner quest_entries_leave: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.quest_entries') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quest_entries' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.quest_entries', 'quest_entries_join'); EXECUTE 'CREATE POLICY "quest_entries_join" ON public.quest_entries FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND status = ''joined'' AND coalesce(proof, '''') = '''')';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quest_entries', 'puesta la regla INSERT quest_entries_join');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quest_entries', '✗ no se pudo poner quest_entries_join: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.quest_entries') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quest_entries' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.quest_entries', 'quest_entries_submit'); EXECUTE 'CREATE POLICY "quest_entries_submit" ON public.quest_entries FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()) AND status IN (''joined'', ''rejected'')) WITH CHECK (user_id = (SELECT auth.uid()) AND status = ''submitted'' AND length(trim(proof)) >= 5)';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quest_entries', 'puesta la regla UPDATE quest_entries_submit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quest_entries', '✗ no se pudo poner quest_entries_submit: ' || SQLERRM); END;
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.quest_entries', 'quest_entries_review'); EXECUTE 'CREATE POLICY "quest_entries_review" ON public.quest_entries FOR UPDATE TO authenticated USING (status = ''submitted'' AND user_id <> (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.quests q WHERE q.id = quest_id
    AND (q.creator_id = (SELECT auth.uid()) OR (q.community_id IS NOT NULL AND public.is_community_staff(q.community_id))))) WITH CHECK (status IN (''approved'', ''rejected'') AND user_id <> (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quest_entries', 'puesta la regla UPDATE quest_entries_review');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quest_entries', '✗ no se pudo poner quest_entries_review: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.quests') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quests' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.quests', 'quests_delete'); EXECUTE 'CREATE POLICY "quests_delete" ON public.quests FOR DELETE TO authenticated USING (private.can_manage_quest(id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quests', 'puesta la regla DELETE quests_delete');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quests', '✗ no se pudo poner quests_delete: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.quests') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quests' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.quests', 'quests_create'); EXECUTE 'CREATE POLICY "quests_create" ON public.quests FOR INSERT TO authenticated WITH CHECK (
  creator_id = (SELECT auth.uid())
  AND (community_id IS NULL OR EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = quests.community_id AND m.user_id = (SELECT auth.uid()))))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quests', 'puesta la regla INSERT quests_create');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quests', '✗ no se pudo poner quests_create: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.quests') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quests' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.quests', 'quests_edit'); EXECUTE 'CREATE POLICY "quests_edit" ON public.quests FOR UPDATE TO authenticated USING (private.can_manage_quest(id)) WITH CHECK (private.can_manage_quest(id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quests', 'puesta la regla UPDATE quests_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quests', '✗ no se pudo poner quests_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.reports') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reports' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.reports', 'reports_add'); EXECUTE 'CREATE POLICY "reports_add" ON public.reports FOR INSERT TO authenticated WITH CHECK (
  reporter_id = (SELECT auth.uid()) AND status = ''open'' AND resolved_by IS NULL AND action IS NULL
  AND coalesce(reported_user_id, ''00000000-0000-0000-0000-000000000000''::uuid) <> (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('reports', 'puesta la regla INSERT reports_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('reports', '✗ no se pudo poner reports_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.reports') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reports' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.reports', 'reports_review'); EXECUTE 'CREATE POLICY "reports_review" ON public.reports FOR UPDATE TO authenticated USING (private.is_app_admin() OR (community_id IS NOT NULL AND public.is_community_staff(community_id))) WITH CHECK (private.is_app_admin() OR (community_id IS NOT NULL AND public.is_community_staff(community_id)))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('reports', 'puesta la regla UPDATE reports_review');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('reports', '✗ no se pudo poner reports_review: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.session_rsvps') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'session_rsvps' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.session_rsvps', 'rsvps_remove'); EXECUTE 'CREATE POLICY "rsvps_remove" ON public.session_rsvps FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('session_rsvps', 'puesta la regla DELETE rsvps_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('session_rsvps', '✗ no se pudo poner rsvps_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.session_rsvps') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'session_rsvps' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.session_rsvps', 'rsvps_add'); EXECUTE 'CREATE POLICY "rsvps_add" ON public.session_rsvps FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND private.can_see_session(session_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('session_rsvps', 'puesta la regla INSERT rsvps_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('session_rsvps', '✗ no se pudo poner rsvps_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.session_rsvps') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'session_rsvps' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.session_rsvps', 'rsvps_edit'); EXECUTE 'CREATE POLICY "rsvps_edit" ON public.session_rsvps FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()) AND private.can_see_session(session_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('session_rsvps', 'puesta la regla UPDATE rsvps_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('session_rsvps', '✗ no se pudo poner rsvps_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_invites') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_invites' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_invites', 'squad_invites_remove'); EXECUTE 'CREATE POLICY "squad_invites_remove" ON public.squad_invites FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()) OR private.is_squad_staff(squad_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_invites', 'puesta la regla DELETE squad_invites_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_invites', '✗ no se pudo poner squad_invites_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_invites') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_invites' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_invites', 'squad_invites_add'); EXECUTE 'CREATE POLICY "squad_invites_add" ON public.squad_invites FOR INSERT TO authenticated WITH CHECK (
  invited_by = (SELECT auth.uid()) AND private.is_squad_staff(squad_id) AND private.squad_role(squad_id, user_id) IS NULL
  AND public.is_not_blocked(user_id) AND private.squad_fits(squad_id, user_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_invites', 'puesta la regla INSERT squad_invites_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_invites', '✗ no se pudo poner squad_invites_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_members') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_members' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_members', 'squad_members_leave'); EXECUTE 'CREATE POLICY "squad_members_leave" ON public.squad_members FOR DELETE TO authenticated USING (
  (user_id = (SELECT auth.uid()) AND role <> ''owner'')
  OR (role <> ''owner'' AND private.squad_role(squad_id, (SELECT auth.uid())) = ''owner'')
  OR (role = ''member'' AND private.squad_role(squad_id, (SELECT auth.uid())) = ''admin''))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_members', 'puesta la regla DELETE squad_members_leave');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_members', '✗ no se pudo poner squad_members_leave: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_members') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_members' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_members', 'squad_members_join'); EXECUTE 'CREATE POLICY "squad_members_join" ON public.squad_members FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND role = ''member''
  AND EXISTS (SELECT 1 FROM public.squads s WHERE s.id = squad_id AND s.privacy = ''abierto'')
  AND private.squad_fits(squad_id, user_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_members', 'puesta la regla INSERT squad_members_join');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_members', '✗ no se pudo poner squad_members_join: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_members') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_members' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_members', 'squad_members_update'); EXECUTE 'CREATE POLICY "squad_members_update" ON public.squad_members FOR UPDATE TO authenticated USING (
  user_id = (SELECT auth.uid()) OR private.squad_role(squad_id, (SELECT auth.uid())) = ''owner'') WITH CHECK (user_id = (SELECT auth.uid()) OR private.squad_role(squad_id, (SELECT auth.uid())) = ''owner'')';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_members', 'puesta la regla UPDATE squad_members_update');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_members', '✗ no se pudo poner squad_members_update: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_memories') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_memories' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_memories', 'memories_remove'); EXECUTE 'CREATE POLICY "memories_remove" ON public.squad_memories FOR DELETE TO authenticated USING (author_id=(SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_memories', 'puesta la regla DELETE memories_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_memories', '✗ no se pudo poner memories_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_memories') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_memories' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_memories', 'memories_add'); EXECUTE 'CREATE POLICY "memories_add" ON public.squad_memories FOR INSERT TO authenticated WITH CHECK (author_id=(SELECT auth.uid()) AND private.is_squad_member(squad_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_memories', 'puesta la regla INSERT memories_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_memories', '✗ no se pudo poner memories_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_memories') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_memories' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_memories', 'memories_edit'); EXECUTE 'CREATE POLICY "memories_edit" ON public.squad_memories FOR UPDATE TO authenticated USING (author_id=(SELECT auth.uid())) WITH CHECK (author_id=(SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_memories', 'puesta la regla UPDATE memories_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_memories', '✗ no se pudo poner memories_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_messages') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_messages' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_messages', 'squad_messages_delete'); EXECUTE 'CREATE POLICY "squad_messages_delete" ON public.squad_messages FOR DELETE TO authenticated USING (sender_id = (SELECT auth.uid()) OR private.is_squad_staff(squad_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_messages', 'puesta la regla DELETE squad_messages_delete');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_messages', '✗ no se pudo poner squad_messages_delete: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_messages') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_messages' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_messages', 'squad_messages_add'); EXECUTE 'CREATE POLICY "squad_messages_add" ON public.squad_messages FOR INSERT TO authenticated WITH CHECK (sender_id=(select auth.uid()) and public.is_squad_member(squad_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_messages', 'puesta la regla INSERT squad_messages_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_messages', '✗ no se pudo poner squad_messages_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_poll_votes') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_poll_votes' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_poll_votes', 'votes_remove'); EXECUTE 'CREATE POLICY "votes_remove" ON public.squad_poll_votes FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_poll_votes', 'puesta la regla DELETE votes_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_poll_votes', '✗ no se pudo poner votes_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_poll_votes') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_poll_votes' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_poll_votes', 'votes_add'); EXECUTE 'CREATE POLICY "votes_add" ON public.squad_poll_votes FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND private.poll_open(poll_id, choice))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_poll_votes', 'puesta la regla INSERT votes_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_poll_votes', '✗ no se pudo poner votes_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_poll_votes') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_poll_votes' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_poll_votes', 'votes_change'); EXECUTE 'CREATE POLICY "votes_change" ON public.squad_poll_votes FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()) AND private.poll_open(poll_id, choice))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_poll_votes', 'puesta la regla UPDATE votes_change');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_poll_votes', '✗ no se pudo poner votes_change: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_polls') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_polls' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_polls', 'polls_remove'); EXECUTE 'CREATE POLICY "polls_remove" ON public.squad_polls FOR DELETE TO authenticated USING (creator_id = (SELECT auth.uid()) OR private.is_squad_staff(squad_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_polls', 'puesta la regla DELETE polls_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_polls', '✗ no se pudo poner polls_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_polls') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_polls' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_polls', 'polls_add'); EXECUTE 'CREATE POLICY "polls_add" ON public.squad_polls FOR INSERT TO authenticated WITH CHECK (creator_id = (SELECT auth.uid()) AND public.is_squad_member(squad_id) AND (closes_at IS NULL OR closes_at > now()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_polls', 'puesta la regla INSERT polls_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_polls', '✗ no se pudo poner polls_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_tracks') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_tracks' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_tracks', 'tracks_remove'); EXECUTE 'CREATE POLICY "tracks_remove" ON public.squad_tracks FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()) OR private.is_squad_staff(squad_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_tracks', 'puesta la regla DELETE tracks_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_tracks', '✗ no se pudo poner tracks_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squad_tracks') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_tracks' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_tracks', 'tracks_add'); EXECUTE 'CREATE POLICY "tracks_add" ON public.squad_tracks FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_squad_member(squad_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_tracks', 'puesta la regla INSERT tracks_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_tracks', '✗ no se pudo poner tracks_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squads') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squads' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squads', 'squads_delete'); EXECUTE 'CREATE POLICY "squads_delete" ON public.squads FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squads', 'puesta la regla DELETE squads_delete');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squads', '✗ no se pudo poner squads_delete: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squads') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squads' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squads', 'squads_add'); EXECUTE 'CREATE POLICY "squads_add" ON public.squads FOR INSERT TO authenticated WITH CHECK (owner_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squads', 'puesta la regla INSERT squads_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squads', '✗ no se pudo poner squads_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.squads') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squads' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.squads', 'squads_edit'); EXECUTE 'CREATE POLICY "squads_edit" ON public.squads FOR UPDATE TO authenticated USING (private.is_squad_staff(id)) WITH CHECK (private.is_squad_staff(id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squads', 'puesta la regla UPDATE squads_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squads', '✗ no se pudo poner squads_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.track_likes') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'track_likes' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.track_likes', 'track_likes_remove'); EXECUTE 'CREATE POLICY "track_likes_remove" ON public.track_likes FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('track_likes', 'puesta la regla DELETE track_likes_remove');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('track_likes', '✗ no se pudo poner track_likes_remove: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.track_likes') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'track_likes' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.track_likes', 'track_likes_add'); EXECUTE 'CREATE POLICY "track_likes_add" ON public.track_likes FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.squad_tracks t WHERE t.id = track_id AND public.is_squad_member(t.squad_id)))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('track_likes', 'puesta la regla INSERT track_likes_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('track_likes', '✗ no se pudo poner track_likes_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.universe_portals') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'universe_portals' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.universe_portals', 'portals_delete'); EXECUTE 'CREATE POLICY "portals_delete" ON public.universe_portals FOR DELETE TO authenticated USING (private.owns_space(space_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_portals', 'puesta la regla DELETE portals_delete');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_portals', '✗ no se pudo poner portals_delete: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.universe_portals') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'universe_portals' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.universe_portals', 'portals_insert'); EXECUTE 'CREATE POLICY "portals_insert" ON public.universe_portals FOR INSERT TO authenticated WITH CHECK (private.owns_space(space_id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_portals', 'puesta la regla INSERT portals_insert');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_portals', '✗ no se pudo poner portals_insert: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.universe_spaces') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'universe_spaces' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.universe_spaces', 'spaces_create'); EXECUTE 'CREATE POLICY "spaces_create" ON public.universe_spaces FOR INSERT TO authenticated WITH CHECK (
 (owner_user_id=(SELECT auth.uid()) AND owner_squad_id IS NULL) OR
 (owner_user_id IS NULL AND EXISTS(SELECT 1 FROM public.squads WHERE id=owner_squad_id AND owner_id=(SELECT auth.uid()))))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_spaces', 'puesta la regla INSERT spaces_create');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_spaces', '✗ no se pudo poner spaces_create: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.universe_spaces') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'universe_spaces' AND permissive = 'PERMISSIVE' AND cmd IN ('UPDATE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.universe_spaces', 'spaces_edit'); EXECUTE 'CREATE POLICY "spaces_edit" ON public.universe_spaces FOR UPDATE TO authenticated USING (private.owns_space(id)) WITH CHECK (private.owns_space(id))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_spaces', 'puesta la regla UPDATE spaces_edit');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_spaces', '✗ no se pudo poner spaces_edit: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.user_games') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_games' AND permissive = 'PERMISSIVE' AND cmd IN ('DELETE', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_games', 'user_games_delete'); EXECUTE 'CREATE POLICY "user_games_delete" ON public.user_games FOR DELETE TO authenticated USING (user_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('user_games', 'puesta la regla DELETE user_games_delete');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('user_games', '✗ no se pudo poner user_games_delete: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.user_games') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_games' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_games', 'user_games_add'); EXECUTE 'CREATE POLICY "user_games_add" ON public.user_games FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('user_games', 'puesta la regla INSERT user_games_add');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('user_games', '✗ no se pudo poner user_games_add: ' || SQLERRM); END;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.waves') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waves' AND permissive = 'PERMISSIVE' AND cmd IN ('INSERT', 'ALL')) THEN
      BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.waves', 'waves_send'); EXECUTE 'CREATE POLICY "waves_send" ON public.waves FOR INSERT TO authenticated WITH CHECK (
  from_id = (SELECT auth.uid()) AND public.is_not_blocked(to_id) AND private.can_interact(from_id, to_id)
  AND EXISTS (SELECT 1 FROM public.availability a WHERE a.user_id = to_id AND a.mode = ''silencioso'' AND a.until > now()))';
        INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('waves', 'puesta la regla INSERT waves_send');
      EXCEPTION WHEN OTHERS THEN INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('waves', '✗ no se pudo poner waves_send: ' || SQLERRM); END;
  END IF;
END $$;

-- ═════ 3 · Recuerdos ═════
-- La regla anterior buscaba el recuerdo en la tabla en el mismo momento de guardarlo (todavía no existe) y lo rechazaba.
DROP POLICY IF EXISTS "memories_read" ON public.squad_memories;
CREATE POLICY "memories_read" ON public.squad_memories FOR SELECT TO authenticated
  USING (author_id = (SELECT auth.uid()) OR private.memory_visible(id));

-- Integrante del squad (si eres el dueño y faltaba tu registro, se repara solo).
CREATE OR REPLACE FUNCTION private.ensure_squad_member(sid uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid());
BEGIN
  IF EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = sid AND user_id = uid) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.squads WHERE id = sid AND owner_id = uid) THEN
    INSERT INTO public.squad_members(squad_id, user_id, role) VALUES (sid, uid, 'owner') ON CONFLICT DO NOTHING; RETURN true;
  END IF;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.send_squad_message(target uuid, body_text text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid()); b text := left(trim(coalesce(body_text, '')), 2000); r public.squad_messages;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión para escribir'; END IF;
  IF b = '' THEN RAISE EXCEPTION 'Escribe un mensaje'; END IF;
  IF NOT private.ensure_squad_member(target) THEN RAISE EXCEPTION 'Únete al squad para escribir en su chat'; END IF;
  INSERT INTO public.squad_messages(squad_id, sender_id, body) VALUES (target, uid, b) RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;

-- Recuerdo + permisos de quienes aparecen, en un solo paso.
CREATE OR REPLACE FUNCTION public.create_squad_memory(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid()); sid uuid := nullif(p ->> 'squad_id', '')::uuid; r public.squad_memories; who uuid;
  t text := trim(coalesce(p ->> 'title', ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
  IF char_length(t) < 3 THEN RAISE EXCEPTION 'El título del recuerdo debe tener al menos 3 caracteres'; END IF;
  IF sid IS NULL OR NOT private.ensure_squad_member(sid) THEN RAISE EXCEPTION 'Solo los integrantes del squad pueden guardar recuerdos'; END IF;
  INSERT INTO public.squad_memories(squad_id, author_id, title, story)
  VALUES (sid, uid, left(t, 90), left(coalesce(p ->> 'story', ''), 1800)) RETURNING * INTO r;
  FOR who IN SELECT DISTINCT (x)::uuid FROM jsonb_array_elements_text(coalesce(p -> 'people', '[]'::jsonb)) x LOOP
    IF who <> uid AND EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = sid AND user_id = who) THEN
      INSERT INTO public.memory_consents(memory_id, user_id, status) VALUES (r.id, who, 'pending') ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN to_jsonb(r);
END $$;
CREATE OR REPLACE FUNCTION public.set_memory_image(target uuid, path text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF path !~ ('^' || target::text || '/' || (SELECT auth.uid())::text || '/[A-Za-z0-9._-]+$') THEN RAISE EXCEPTION 'Ruta de imagen no válida'; END IF;
  UPDATE public.squad_memories SET image_path = path WHERE id = target AND author_id = (SELECT auth.uid());
END $$;

-- ═════ 4 · Foto de squads y comunidades ═════
ALTER TABLE public.squads ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS avatar_url text;
DO $$ BEGIN
  ALTER TABLE public.squads ADD CONSTRAINT squads_avatar_https CHECK (avatar_url IS NULL OR (avatar_url ~ '^https://' AND char_length(avatar_url) <= 600));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.communities ADD CONSTRAINT communities_avatar_https CHECK (avatar_url IS NULL OR (avatar_url ~ '^https://' AND char_length(avatar_url) <= 600));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Squad: dueño o admin. Comunidad: dueño o moderación. url = null quita la foto.
CREATE OR REPLACE FUNCTION public.set_group_photo(kind text, target uuid, url text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid());
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
  IF url IS NOT NULL AND (url !~ '^https://' OR char_length(url) > 600) THEN RAISE EXCEPTION 'Imagen no válida'; END IF;
  IF kind = 'squad' THEN
    IF NOT EXISTS (SELECT 1 FROM public.squads WHERE id = target AND owner_id = uid)
       AND NOT EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = target AND user_id = uid AND role IN ('owner', 'admin')) THEN
      RAISE EXCEPTION 'Solo el dueño o un admin del squad puede cambiar su foto';
    END IF;
    UPDATE public.squads SET avatar_url = url WHERE id = target;
  ELSIF kind = 'community' THEN
    IF NOT EXISTS (SELECT 1 FROM public.communities WHERE id = target AND owner_id = uid)
       AND NOT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = target AND user_id = uid AND role IN ('owner', 'moderator')) THEN
      RAISE EXCEPTION 'Solo quien fundó o modera la comunidad puede cambiar su foto';
    END IF;
    UPDATE public.communities SET avatar_url = url WHERE id = target;
  ELSE RAISE EXCEPTION 'Tipo no válido'; END IF;
END $$;

REVOKE ALL ON FUNCTION private.ensure_squad_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.ensure_squad_member(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.send_squad_message(uuid, text), public.create_squad_memory(jsonb), public.set_memory_image(uuid, text), public.set_group_photo(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_squad_message(uuid, text), public.create_squad_memory(jsonb), public.set_memory_image(uuid, text), public.set_group_photo(text, uuid, text) TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
COMMIT;

-- ═════ Informe ═════
SELECT tabla AS "Tabla", accion AS "Qué se reparó" FROM public._gvq_repair_log
UNION ALL SELECT '—', CASE WHEN EXISTS (SELECT 1 FROM public._gvq_repair_log) THEN 'Fin de la lista' ELSE 'Todo estaba bien: no hizo falta reparar reglas' END
UNION ALL SELECT 'Funciones nuevas', CASE WHEN to_regprocedure('public.send_squad_message(uuid,text)') IS NOT NULL AND to_regprocedure('public.set_group_photo(text,uuid,text)') IS NOT NULL THEN '✓' ELSE '✗' END;
