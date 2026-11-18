-- GAMVORAQ · 013 · Revisión completa de la base de datos (reglas de lectura y permisos).
-- Por qué: casi todos los errores («no se ven los squads/chats/retos», «no tienes permiso») venían de
-- tablas sin regla de lectura o con reglas RESTRICTIVAS que no son de GAMVORAQ.
-- Qué hace, tabla por tabla (solo en las tablas de la app):
--   · guarda un respaldo de las reglas actuales en public._gvq_policy_backup;
--   · quita reglas RESTRICTIVAS de lectura (GAMVORAQ no usa ninguna);
--   · si la tabla NO tiene regla para leer, pone la oficial de GAMVORAQ;
--   · activa RLS y da los permisos básicos a las cuentas con sesión (RLS sigue decidiendo qué fila ve cada quien).
-- No toca las reglas para crear, editar o borrar. Se puede ejecutar varias veces.
-- Al final muestra un informe: cada tabla, qué se reparó y cuántas filas ve tu cuenta.
BEGIN;
CREATE TABLE IF NOT EXISTS public._gvq_policy_backup AS SELECT now() AS saved_at, * FROM pg_policies WHERE false;
ALTER TABLE public._gvq_policy_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._gvq_policy_backup FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS public._gvq_repair_log (at timestamptz DEFAULT now(), tabla text, accion text);
ALTER TABLE public._gvq_repair_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._gvq_repair_log FROM anon, authenticated;
DELETE FROM public._gvq_repair_log;
INSERT INTO public._gvq_policy_backup SELECT now(), * FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('availability', 'badges', 'blocked_words', 'blocks', 'channel_messages', 'channels', 'chat_reads', 'chemistry_ratings', 'chronicle_options', 'chronicle_votes', 'chronicles', 'comments', 'communities', 'community_members', 'conduct_strikes', 'conversation_hides', 'conversations', 'direct_messages', 'family_links', 'follows', 'gallery', 'games', 'guide_offers', 'guide_requests', 'league_matches', 'league_teams', 'leagues', 'memory_consents', 'mod_log', 'notifications', 'play_sessions', 'post_images', 'post_reactions', 'posts', 'profile_private', 'profiles', 'pulse_members', 'pulse_messages', 'pulse_rooms', 'push_subscriptions', 'quest_entries', 'quests', 'reports', 'session_rsvps', 'squad_invites', 'squad_members', 'squad_memories', 'squad_messages', 'squad_poll_votes', 'squad_polls', 'squad_tracks', 'squads', 'suspensions', 'track_likes', 'universe_portals', 'universe_spaces', 'user_games', 'waves');
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.availability') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'availability' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.availability', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('availability', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.availability NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'availability' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.availability', 'availability_read');
      EXECUTE 'CREATE POLICY "availability_read" ON public.availability FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR (public.is_not_blocked(user_id) AND private.same_age_band((SELECT auth.uid()), user_id)))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('availability', 'puesta la regla de lectura availability_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('availability', '✗ no se pudo poner availability_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.badges') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'badges' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.badges', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('badges', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.badges NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'badges' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.badges', 'badges_read');
      EXECUTE 'CREATE POLICY "badges_read" ON public.badges FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('badges', 'puesta la regla de lectura badges_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('badges', '✗ no se pudo poner badges_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.blocked_words') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocked_words' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.blocked_words', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('blocked_words', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.blocked_words ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.blocked_words NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_words TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocked_words' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.blocked_words', 'blocked_words_read');
      EXECUTE 'CREATE POLICY "blocked_words_read" ON public.blocked_words FOR SELECT TO authenticated USING (private.is_app_admin())';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('blocked_words', 'puesta la regla de lectura blocked_words_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('blocked_words', '✗ no se pudo poner blocked_words_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.blocks') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocks' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.blocks', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('blocks', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.blocks NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocks TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocks' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.blocks', 'blocks_read');
      EXECUTE 'CREATE POLICY "blocks_read" ON public.blocks FOR SELECT TO authenticated USING (blocker_id=(select auth.uid()))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('blocks', 'puesta la regla de lectura blocks_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('blocks', '✗ no se pudo poner blocks_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.channel_messages') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'channel_messages' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.channel_messages', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('channel_messages', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.channel_messages NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_messages TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'channel_messages' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.channel_messages', 'channel_msgs_read');
      EXECUTE 'CREATE POLICY "channel_msgs_read" ON public.channel_messages FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('channel_messages', 'puesta la regla de lectura channel_msgs_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('channel_messages', '✗ no se pudo poner channel_msgs_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.channels') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'channels' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.channels', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('channels', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.channels NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'channels' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.channels', 'channels_read');
      EXECUTE 'CREATE POLICY "channels_read" ON public.channels FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('channels', 'puesta la regla de lectura channels_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('channels', '✗ no se pudo poner channels_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.chat_reads') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_reads' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.chat_reads', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chat_reads', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.chat_reads NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_reads TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_reads' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_reads', 'chat_reads_read');
      EXECUTE 'CREATE POLICY "chat_reads_read" ON public.chat_reads FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR (chat_kind = ''dm'' AND public.is_conversation_member(chat_id)))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chat_reads', 'puesta la regla de lectura chat_reads_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chat_reads', '✗ no se pudo poner chat_reads_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.chemistry_ratings') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chemistry_ratings' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.chemistry_ratings', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chemistry_ratings', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.chemistry_ratings ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.chemistry_ratings NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.chemistry_ratings TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chemistry_ratings' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.chemistry_ratings', 'chemistry_read_own');
      EXECUTE 'CREATE POLICY "chemistry_read_own" ON public.chemistry_ratings FOR SELECT TO authenticated USING (rater_id = (SELECT auth.uid()))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chemistry_ratings', 'puesta la regla de lectura chemistry_read_own');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chemistry_ratings', '✗ no se pudo poner chemistry_read_own: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.chronicle_options') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chronicle_options' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.chronicle_options', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicle_options', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.chronicle_options ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.chronicle_options NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.chronicle_options TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chronicle_options' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.chronicle_options', 'options_read');
      EXECUTE 'CREATE POLICY "options_read" ON public.chronicle_options FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.chronicles c WHERE c.id=chronicle_id AND private.is_community_member(c.community_id)))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicle_options', 'puesta la regla de lectura options_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicle_options', '✗ no se pudo poner options_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.chronicle_votes') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chronicle_votes' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.chronicle_votes', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicle_votes', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.chronicle_votes ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.chronicle_votes NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.chronicle_votes TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chronicle_votes' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.chronicle_votes', 'votes_read');
      EXECUTE 'CREATE POLICY "votes_read" ON public.chronicle_votes FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.chronicles c WHERE c.id=chronicle_id AND private.is_community_member(c.community_id)))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicle_votes', 'puesta la regla de lectura votes_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicle_votes', '✗ no se pudo poner votes_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.chronicles') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chronicles' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.chronicles', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicles', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.chronicles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.chronicles NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.chronicles TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chronicles' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.chronicles', 'chronicles_read');
      EXECUTE 'CREATE POLICY "chronicles_read" ON public.chronicles FOR SELECT TO authenticated USING (private.is_community_member(community_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicles', 'puesta la regla de lectura chronicles_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('chronicles', '✗ no se pudo poner chronicles_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.comments') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'comments' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.comments', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('comments', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.comments NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'comments' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.comments', 'comments_read');
      EXECUTE 'CREATE POLICY "comments_read" ON public.comments FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('comments', 'puesta la regla de lectura comments_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('comments', '✗ no se pudo poner comments_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.communities') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communities' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.communities', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('communities', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.communities NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communities' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.communities', 'communities_read');
      EXECUTE 'CREATE POLICY "communities_read" ON public.communities FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('communities', 'puesta la regla de lectura communities_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('communities', '✗ no se pudo poner communities_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.community_members') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_members' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.community_members', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('community_members', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.community_members NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_members TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_members' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.community_members', 'members_read');
      EXECUTE 'CREATE POLICY "members_read" ON public.community_members FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('community_members', 'puesta la regla de lectura members_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('community_members', '✗ no se pudo poner members_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.conduct_strikes') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conduct_strikes' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.conduct_strikes', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('conduct_strikes', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.conduct_strikes ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.conduct_strikes NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.conduct_strikes TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conduct_strikes' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.conduct_strikes', 'strikes_read');
      EXECUTE 'CREATE POLICY "strikes_read" ON public.conduct_strikes FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR (community_id IS NOT NULL AND public.is_community_staff(community_id)))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('conduct_strikes', 'puesta la regla de lectura strikes_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('conduct_strikes', '✗ no se pudo poner strikes_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.conversation_hides') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversation_hides' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.conversation_hides', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('conversation_hides', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.conversation_hides ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.conversation_hides NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_hides TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversation_hides' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversation_hides', 'hides_own');
      EXECUTE 'CREATE POLICY "hides_own" ON public.conversation_hides FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_conversation_member(conversation_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('conversation_hides', 'puesta la regla de lectura hides_own');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('conversation_hides', '✗ no se pudo poner hides_own: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.conversations') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.conversations', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('conversations', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.conversations NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversations', 'conversations_read');
      EXECUTE 'CREATE POLICY "conversations_read" ON public.conversations FOR SELECT TO authenticated USING (user_low = (SELECT auth.uid()) OR user_high = (SELECT auth.uid()))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('conversations', 'puesta la regla de lectura conversations_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('conversations', '✗ no se pudo poner conversations_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.direct_messages') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'direct_messages' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.direct_messages', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('direct_messages', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.direct_messages NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'direct_messages' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.direct_messages', 'dms_read');
      EXECUTE 'CREATE POLICY "dms_read" ON public.direct_messages FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('direct_messages', 'puesta la regla de lectura dms_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('direct_messages', '✗ no se pudo poner dms_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.family_links') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'family_links' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.family_links', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('family_links', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.family_links ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.family_links NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_links TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'family_links' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.family_links', 'family_read');
      EXECUTE 'CREATE POLICY "family_read" ON public.family_links FOR SELECT TO authenticated USING (guardian_id = (SELECT auth.uid()) OR minor_id = (SELECT auth.uid()))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('family_links', 'puesta la regla de lectura family_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('family_links', '✗ no se pudo poner family_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.follows') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'follows' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.follows', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('follows', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.follows NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'follows' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.follows', 'follows_read');
      EXECUTE 'CREATE POLICY "follows_read" ON public.follows FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('follows', 'puesta la regla de lectura follows_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('follows', '✗ no se pudo poner follows_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.gallery') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gallery' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.gallery', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('gallery', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.gallery NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gallery' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.gallery', 'gallery_read');
      EXECUTE 'CREATE POLICY "gallery_read" ON public.gallery FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('gallery', 'puesta la regla de lectura gallery_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('gallery', '✗ no se pudo poner gallery_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.games') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'games' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.games', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('games', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.games ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.games NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'games' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.games', 'games_read');
      EXECUTE 'CREATE POLICY "games_read" ON public.games FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('games', 'puesta la regla de lectura games_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('games', '✗ no se pudo poner games_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.guide_offers') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guide_offers' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.guide_offers', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_offers', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.guide_offers ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.guide_offers NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_offers TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guide_offers' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.guide_offers', 'guide_offers_read');
      EXECUTE 'CREATE POLICY "guide_offers_read" ON public.guide_offers FOR SELECT TO authenticated USING (public.is_not_blocked(user_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_offers', 'puesta la regla de lectura guide_offers_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_offers', '✗ no se pudo poner guide_offers_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.guide_requests') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guide_requests' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.guide_requests', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_requests', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.guide_requests ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.guide_requests NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_requests TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guide_requests' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.guide_requests', 'guide_requests_read');
      EXECUTE 'CREATE POLICY "guide_requests_read" ON public.guide_requests FOR SELECT TO authenticated USING (
  guide_id = (SELECT auth.uid()) OR learner_id = (SELECT auth.uid()))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_requests', 'puesta la regla de lectura guide_requests_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('guide_requests', '✗ no se pudo poner guide_requests_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.league_matches') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'league_matches' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.league_matches', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_matches', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.league_matches ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.league_matches NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_matches TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'league_matches' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_matches', 'league_matches_read');
      EXECUTE 'CREATE POLICY "league_matches_read" ON public.league_matches FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_matches', 'puesta la regla de lectura league_matches_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_matches', '✗ no se pudo poner league_matches_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.league_teams') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'league_teams' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.league_teams', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_teams', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.league_teams ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.league_teams NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_teams TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'league_teams' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_teams', 'league_teams_read');
      EXECUTE 'CREATE POLICY "league_teams_read" ON public.league_teams FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_teams', 'puesta la regla de lectura league_teams_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('league_teams', '✗ no se pudo poner league_teams_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.leagues') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leagues' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.leagues', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('leagues', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.leagues NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.leagues TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leagues' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.leagues', 'leagues_read');
      EXECUTE 'CREATE POLICY "leagues_read" ON public.leagues FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('leagues', 'puesta la regla de lectura leagues_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('leagues', '✗ no se pudo poner leagues_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.memory_consents') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'memory_consents' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.memory_consents', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('memory_consents', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.memory_consents ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.memory_consents NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_consents TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'memory_consents' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.memory_consents', 'consents_read');
      EXECUTE 'CREATE POLICY "consents_read" ON public.memory_consents FOR SELECT TO authenticated USING (private.memory_visible(memory_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('memory_consents', 'puesta la regla de lectura consents_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('memory_consents', '✗ no se pudo poner consents_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.mod_log') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mod_log' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.mod_log', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('mod_log', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.mod_log ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.mod_log NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.mod_log TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mod_log' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.mod_log', 'mod_log_read');
      EXECUTE 'CREATE POLICY "mod_log_read" ON public.mod_log FOR SELECT TO authenticated USING (private.is_app_admin())';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('mod_log', 'puesta la regla de lectura mod_log_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('mod_log', '✗ no se pudo poner mod_log_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.notifications') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.notifications', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('notifications', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.notifications NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', 'notifications_read');
      EXECUTE 'CREATE POLICY "notifications_read" ON public.notifications FOR SELECT TO authenticated USING (user_id=(select auth.uid()))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('notifications', 'puesta la regla de lectura notifications_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('notifications', '✗ no se pudo poner notifications_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.play_sessions') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'play_sessions' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.play_sessions', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('play_sessions', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.play_sessions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.play_sessions NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.play_sessions TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'play_sessions' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.play_sessions', 'sessions_read');
      EXECUTE 'CREATE POLICY "sessions_read" ON public.play_sessions FOR SELECT TO authenticated USING (private.can_see_session(id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('play_sessions', 'puesta la regla de lectura sessions_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('play_sessions', '✗ no se pudo poner sessions_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.post_images') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_images' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.post_images', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_images', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.post_images NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_images TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_images' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_images', 'images_read');
      EXECUTE 'CREATE POLICY "images_read" ON public.post_images FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_images', 'puesta la regla de lectura images_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_images', '✗ no se pudo poner images_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.post_reactions') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_reactions' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.post_reactions', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_reactions', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.post_reactions NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reactions TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_reactions' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_reactions', 'reactions_read');
      EXECUTE 'CREATE POLICY "reactions_read" ON public.post_reactions FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_reactions', 'puesta la regla de lectura reactions_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('post_reactions', '✗ no se pudo poner reactions_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.posts') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.posts', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('posts', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.posts NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.posts', 'posts_read');
      EXECUTE 'CREATE POLICY "posts_read" ON public.posts FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('posts', 'puesta la regla de lectura posts_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('posts', '✗ no se pudo poner posts_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.profile_private') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_private' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.profile_private', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profile_private', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.profile_private NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_private TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_private' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.profile_private', 'private_self_read');
      EXECUTE 'CREATE POLICY "private_self_read" ON public.profile_private FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profile_private', 'puesta la regla de lectura private_self_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profile_private', '✗ no se pudo poner private_self_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.profiles') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profiles', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.profiles NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', 'profiles_read');
      EXECUTE 'CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profiles', 'puesta la regla de lectura profiles_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('profiles', '✗ no se pudo poner profiles_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.pulse_members') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pulse_members' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.pulse_members', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_members', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.pulse_members ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.pulse_members NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.pulse_members TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pulse_members' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.pulse_members', 'pulse_members_read');
      EXECUTE 'CREATE POLICY "pulse_members_read" ON public.pulse_members FOR SELECT TO authenticated USING (private.pulse_visible(room_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_members', 'puesta la regla de lectura pulse_members_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_members', '✗ no se pudo poner pulse_members_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.pulse_messages') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pulse_messages' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.pulse_messages', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_messages', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.pulse_messages ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.pulse_messages NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.pulse_messages TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pulse_messages' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.pulse_messages', 'pulse_messages_read');
      EXECUTE 'CREATE POLICY "pulse_messages_read" ON public.pulse_messages FOR SELECT TO authenticated USING (private.is_pulse_member(room_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_messages', 'puesta la regla de lectura pulse_messages_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_messages', '✗ no se pudo poner pulse_messages_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.pulse_rooms') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pulse_rooms' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.pulse_rooms', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_rooms', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.pulse_rooms ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.pulse_rooms NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.pulse_rooms TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pulse_rooms' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.pulse_rooms', 'pulse_read');
      EXECUTE 'CREATE POLICY "pulse_read" ON public.pulse_rooms FOR SELECT TO authenticated USING (private.pulse_visible(id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_rooms', 'puesta la regla de lectura pulse_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('pulse_rooms', '✗ no se pudo poner pulse_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.push_subscriptions') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.push_subscriptions', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('push_subscriptions', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.push_subscriptions NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.push_subscriptions', 'push_own');
      EXECUTE 'CREATE POLICY "push_own" ON public.push_subscriptions FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('push_subscriptions', 'puesta la regla de lectura push_own');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('push_subscriptions', '✗ no se pudo poner push_own: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.quest_entries') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quest_entries' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.quest_entries', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quest_entries', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.quest_entries ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.quest_entries NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.quest_entries TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quest_entries' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.quest_entries', 'quest_entries_read');
      EXECUTE 'CREATE POLICY "quest_entries_read" ON public.quest_entries FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.quests q WHERE q.id = quest_id
    AND (q.creator_id = (SELECT auth.uid()) OR (q.community_id IS NOT NULL AND public.is_community_staff(q.community_id)))))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quest_entries', 'puesta la regla de lectura quest_entries_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quest_entries', '✗ no se pudo poner quest_entries_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.quests') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quests' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.quests', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quests', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.quests NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.quests TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quests' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.quests', 'quests_read');
      EXECUTE 'CREATE POLICY "quests_read" ON public.quests FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quests', 'puesta la regla de lectura quests_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('quests', '✗ no se pudo poner quests_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.reports') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reports' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.reports', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('reports', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.reports NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reports' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.reports', 'reports_read');
      EXECUTE 'CREATE POLICY "reports_read" ON public.reports FOR SELECT TO authenticated USING (
  reporter_id = (SELECT auth.uid()) OR private.is_app_admin() OR (community_id IS NOT NULL AND public.is_community_staff(community_id)))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('reports', 'puesta la regla de lectura reports_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('reports', '✗ no se pudo poner reports_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.session_rsvps') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'session_rsvps' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.session_rsvps', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('session_rsvps', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.session_rsvps ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.session_rsvps NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_rsvps TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'session_rsvps' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.session_rsvps', 'rsvps_read');
      EXECUTE 'CREATE POLICY "rsvps_read" ON public.session_rsvps FOR SELECT TO authenticated USING (private.can_see_session(session_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('session_rsvps', 'puesta la regla de lectura rsvps_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('session_rsvps', '✗ no se pudo poner rsvps_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.squad_invites') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_invites' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.squad_invites', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_invites', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.squad_invites ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.squad_invites NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_invites TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_invites' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_invites', 'squad_invites_read');
      EXECUTE 'CREATE POLICY "squad_invites_read" ON public.squad_invites FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR private.is_squad_staff(squad_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_invites', 'puesta la regla de lectura squad_invites_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_invites', '✗ no se pudo poner squad_invites_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.squad_members') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_members' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.squad_members', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_members', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.squad_members NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_members TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_members' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_members', 'squad_members_read');
      EXECUTE 'CREATE POLICY "squad_members_read" ON public.squad_members FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_members', 'puesta la regla de lectura squad_members_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_members', '✗ no se pudo poner squad_members_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.squad_memories') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_memories' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.squad_memories', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_memories', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.squad_memories ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.squad_memories NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_memories TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_memories' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_memories', 'memories_read');
      EXECUTE 'CREATE POLICY "memories_read" ON public.squad_memories FOR SELECT TO authenticated USING (private.memory_visible(id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_memories', 'puesta la regla de lectura memories_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_memories', '✗ no se pudo poner memories_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.squad_messages') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_messages' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.squad_messages', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_messages', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.squad_messages ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.squad_messages NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_messages TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_messages' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_messages', 'squad_messages_read');
      EXECUTE 'CREATE POLICY "squad_messages_read" ON public.squad_messages FOR SELECT TO authenticated USING (public.is_squad_member(squad_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_messages', 'puesta la regla de lectura squad_messages_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_messages', '✗ no se pudo poner squad_messages_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.squad_poll_votes') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_poll_votes' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.squad_poll_votes', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_poll_votes', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.squad_poll_votes ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.squad_poll_votes NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_poll_votes TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_poll_votes' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_poll_votes', 'votes_read');
      EXECUTE 'CREATE POLICY "votes_read" ON public.squad_poll_votes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.squad_polls p WHERE p.id = poll_id AND public.is_squad_member(p.squad_id)))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_poll_votes', 'puesta la regla de lectura votes_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_poll_votes', '✗ no se pudo poner votes_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.squad_polls') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_polls' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.squad_polls', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_polls', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.squad_polls ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.squad_polls NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_polls TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_polls' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_polls', 'polls_read');
      EXECUTE 'CREATE POLICY "polls_read" ON public.squad_polls FOR SELECT TO authenticated USING (public.is_squad_member(squad_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_polls', 'puesta la regla de lectura polls_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_polls', '✗ no se pudo poner polls_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.squad_tracks') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_tracks' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.squad_tracks', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_tracks', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.squad_tracks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.squad_tracks NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_tracks TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squad_tracks' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.squad_tracks', 'tracks_read');
      EXECUTE 'CREATE POLICY "tracks_read" ON public.squad_tracks FOR SELECT TO authenticated USING (public.is_squad_member(squad_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_tracks', 'puesta la regla de lectura tracks_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squad_tracks', '✗ no se pudo poner tracks_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.squads') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squads' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.squads', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squads', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.squads NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.squads TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'squads' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.squads', 'squads_read');
      EXECUTE 'CREATE POLICY "squads_read" ON public.squads FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squads', 'puesta la regla de lectura squads_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('squads', '✗ no se pudo poner squads_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.suspensions') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suspensions' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.suspensions', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('suspensions', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.suspensions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.suspensions NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.suspensions TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suspensions' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.suspensions', 'suspensions_read');
      EXECUTE 'CREATE POLICY "suspensions_read" ON public.suspensions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR private.is_app_admin())';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('suspensions', 'puesta la regla de lectura suspensions_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('suspensions', '✗ no se pudo poner suspensions_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.track_likes') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'track_likes' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.track_likes', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('track_likes', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.track_likes ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.track_likes NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.track_likes TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'track_likes' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.track_likes', 'track_likes_read');
      EXECUTE 'CREATE POLICY "track_likes_read" ON public.track_likes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.squad_tracks t WHERE t.id = track_id AND public.is_squad_member(t.squad_id)))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('track_likes', 'puesta la regla de lectura track_likes_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('track_likes', '✗ no se pudo poner track_likes_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.universe_portals') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'universe_portals' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.universe_portals', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_portals', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.universe_portals ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.universe_portals NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.universe_portals TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'universe_portals' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.universe_portals', 'portals_read');
      EXECUTE 'CREATE POLICY "portals_read" ON public.universe_portals FOR SELECT TO authenticated USING (private.space_visible(space_id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_portals', 'puesta la regla de lectura portals_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_portals', '✗ no se pudo poner portals_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.universe_spaces') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'universe_spaces' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.universe_spaces', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_spaces', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.universe_spaces ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.universe_spaces NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.universe_spaces TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'universe_spaces' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.universe_spaces', 'spaces_read');
      EXECUTE 'CREATE POLICY "spaces_read" ON public.universe_spaces FOR SELECT TO authenticated USING (private.space_visible(id))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_spaces', 'puesta la regla de lectura spaces_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('universe_spaces', '✗ no se pudo poner spaces_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.user_games') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_games' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.user_games', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('user_games', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.user_games ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.user_games NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_games TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_games' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_games', 'user_games_read');
      EXECUTE 'CREATE POLICY "user_games_read" ON public.user_games FOR SELECT TO authenticated USING (true)';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('user_games', 'puesta la regla de lectura user_games_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('user_games', '✗ no se pudo poner user_games_read: ' || SQLERRM);
    END;
  END IF;
END $$;
DO $$ DECLARE p record; BEGIN
  IF to_regclass('public.waves') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waves' AND permissive = 'RESTRICTIVE' AND cmd IN ('SELECT', 'ALL') LOOP
    EXECUTE format('DROP POLICY %I ON public.waves', p.policyname);
    INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('waves', 'quitada regla restrictiva ' || p.policyname);
  END LOOP;
  EXECUTE 'ALTER TABLE public.waves ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.waves NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.waves TO authenticated';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waves' AND permissive = 'PERMISSIVE' AND cmd IN ('SELECT', 'ALL')) THEN
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.waves', 'waves_read');
      EXECUTE 'CREATE POLICY "waves_read" ON public.waves FOR SELECT TO authenticated USING (from_id = (SELECT auth.uid()) OR to_id = (SELECT auth.uid()))';
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('waves', 'puesta la regla de lectura waves_read');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._gvq_repair_log(tabla, accion) VALUES ('waves', '✗ no se pudo poner waves_read: ' || SQLERRM);
    END;
  END IF;
END $$;
-- Permisos de funciones internas que usan las reglas (si faltan, las reglas fallan en silencio).
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
COMMIT;

-- ═════ Informe ═════
create or replace function pg_temp.gvq_audit(mail text) returns table(tabla text, lectura text, reparado text, en_la_base bigint, tu_cuenta_ve text) language plpgsql as $$
declare uid uuid := (select id from auth.users where email = mail); t text; n bigint; v text; r record;
begin
  create temp table _a(tabla text, lectura text, reparado text, en_la_base bigint, tu_cuenta_ve text) on commit drop;
  for t in select unnest(array['availability', 'badges', 'blocked_words', 'blocks', 'channel_messages', 'channels', 'chat_reads', 'chemistry_ratings', 'chronicle_options', 'chronicle_votes', 'chronicles', 'comments', 'communities', 'community_members', 'conduct_strikes', 'conversation_hides', 'conversations', 'direct_messages', 'family_links', 'follows', 'gallery', 'games', 'guide_offers', 'guide_requests', 'league_matches', 'league_teams', 'leagues', 'memory_consents', 'mod_log', 'notifications', 'play_sessions', 'post_images', 'post_reactions', 'posts', 'profile_private', 'profiles', 'pulse_members', 'pulse_messages', 'pulse_rooms', 'push_subscriptions', 'quest_entries', 'quests', 'reports', 'session_rsvps', 'squad_invites', 'squad_members', 'squad_memories', 'squad_messages', 'squad_poll_votes', 'squad_polls', 'squad_tracks', 'squads', 'suspensions', 'track_likes', 'universe_portals', 'universe_spaces', 'user_games', 'waves']) loop
    if to_regclass('public.' || t) is null then insert into _a values (t, '— no existe (opcional)', '', null, ''); continue; end if;
    execute format('select count(*) from public.%I', t) into n;
    insert into _a values (t,
      coalesce((select string_agg(policyname, ', ') from pg_policies where schemaname = 'public' and tablename = t and cmd in ('SELECT', 'ALL')), '✗ ninguna'),
      coalesce((select string_agg(accion, '; ') from public._gvq_repair_log l where l.tabla = t), ''), n, '');
  end loop;
  if uid is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    for r in select a.tabla from _a a where a.en_la_base is not null loop
      set local role authenticated;
      begin execute format('select count(*) from public.%I', r.tabla) into n; v := n::text;
      exception when others then v := '✗ ' || left(sqlerrm, 60); end;
      reset role;
      update _a set tu_cuenta_ve = v where _a.tabla = r.tabla;
    end loop;
  end if;
  return query select * from _a order by (case when _a.lectura like '✗%' or _a.tu_cuenta_ve like '✗%' then 0 when _a.reparado <> '' then 1 else 2 end), _a.tabla;
end $$;
select * from pg_temp.gvq_audit('deividmora93@gmail.com');
