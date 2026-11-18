-- GAMVORAQ v4 / Additive migration. Execute AFTER 001_gamvoraq_social.sql.
-- Works with a v3 database; does not drop or reset user data.
-- Live Pulse represents explicitly joined in-app rooms, NEVER physical location.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE public.universe_spaces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
 owner_squad_id uuid UNIQUE REFERENCES public.squads(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 65),
 tagline text NOT NULL DEFAULT '' CHECK (char_length(tagline)<=180),
 theme text NOT NULL DEFAULT 'crimson' CHECK (theme IN ('crimson','nebula','embers')),
 visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','members','private')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT one_universe_owner CHECK ((owner_user_id IS NULL) <> (owner_squad_id IS NULL))
);
CREATE TABLE public.universe_portals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 space_id uuid NOT NULL REFERENCES public.universe_spaces(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('profile','community','squad','pulse','memories','chronicles')),
 target_id uuid,
 label text NOT NULL CHECK (char_length(label) BETWEEN 2 AND 50),
 pos_x smallint NOT NULL CHECK(pos_x BETWEEN 12 AND 88),
 pos_y smallint NOT NULL CHECK(pos_y BETWEEN 15 AND 85),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.squad_memories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES public.profiles(id),
 title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 90),
 story text NOT NULL DEFAULT '' CHECK(char_length(story)<=1800),
 image_path text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.memory_consents (
 memory_id uuid NOT NULL REFERENCES public.squad_memories(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
 decided_at timestamptz,
 PRIMARY KEY(memory_id,user_id)
);
CREATE TABLE public.pulse_rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 host_id uuid NOT NULL REFERENCES public.profiles(id),
 title text NOT NULL CHECK(char_length(title) BETWEEN 5 AND 75),
 game_id bigint REFERENCES public.games(id) ON DELETE SET NULL,
 community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE,
 squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE,
 visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','community','squad')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 capacity smallint NOT NULL DEFAULT 6 CHECK(capacity BETWEEN 2 AND 20),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '2 hours'),
 CONSTRAINT pulse_visibility_consistency CHECK (
 (visibility='public' AND community_id IS NULL AND squad_id IS NULL)
 OR (visibility='community' AND community_id IS NOT NULL AND squad_id IS NULL)
 OR (visibility='squad' AND squad_id IS NOT NULL AND community_id IS NULL))
);
CREATE TABLE public.pulse_members (
 room_id uuid NOT NULL REFERENCES public.pulse_rooms(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 joined_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(room_id,user_id)
);
CREATE TABLE public.pulse_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 room_id uuid NOT NULL REFERENCES public.pulse_rooms(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1500),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chronicles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
 creator_id uuid NOT NULL REFERENCES public.profiles(id),
 title text NOT NULL CHECK(char_length(title) BETWEEN 4 AND 90),
 intro text NOT NULL DEFAULT '' CHECK(char_length(intro)<=1700),
 chapter_no integer NOT NULL DEFAULT 1 CHECK(chapter_no BETWEEN 1 AND 99),
 question text NOT NULL CHECK(char_length(question) BETWEEN 8 AND 300),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 resolution text NOT NULL DEFAULT '' CHECK(char_length(resolution)<=1800),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chronicle_options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 chronicle_id uuid NOT NULL REFERENCES public.chronicles(id) ON DELETE CASCADE,
 chapter_no integer NOT NULL CHECK(chapter_no BETWEEN 1 AND 99),
 label text NOT NULL CHECK(char_length(label) BETWEEN 2 AND 130),
 UNIQUE(chronicle_id,chapter_no,id)
);
CREATE TABLE public.chronicle_votes (
 chronicle_id uuid NOT NULL,
 chapter_no integer NOT NULL,
 option_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(chronicle_id,chapter_no,user_id),
 FOREIGN KEY(chronicle_id,chapter_no,option_id)
  REFERENCES public.chronicle_options(chronicle_id,chapter_no,id) ON DELETE CASCADE
);

-- Fixed-context helper functions, not exposed as browser-callable RPC.
CREATE FUNCTION private.safe_uuid(value text) RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN RETURN value::uuid;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END; $$;
CREATE FUNCTION private.is_community_member(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id=cid AND m.user_id=(SELECT auth.uid()));
$$;
CREATE FUNCTION private.is_community_staff(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id=cid AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','moderator'));
$$;
CREATE FUNCTION private.is_squad_member(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (SELECT 1 FROM public.squad_members m WHERE m.squad_id=sid AND m.user_id=(SELECT auth.uid()));
$$;
CREATE FUNCTION private.owns_space(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (SELECT 1 FROM public.universe_spaces s
 WHERE s.id=sid AND (s.owner_user_id=(SELECT auth.uid()) OR EXISTS
 (SELECT 1 FROM public.squads q WHERE q.id=s.owner_squad_id AND q.owner_id=(SELECT auth.uid()))));
$$;
CREATE FUNCTION private.space_visible(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.universe_spaces s WHERE s.id=sid AND (
 s.owner_user_id=(SELECT auth.uid()) OR (s.owner_squad_id IS NOT NULL AND private.is_squad_member(s.owner_squad_id))
 OR s.visibility='public'));
$$;
CREATE FUNCTION private.memory_approved(mid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.memory_consents c WHERE c.memory_id=mid)
 AND NOT EXISTS(SELECT 1 FROM public.memory_consents c WHERE c.memory_id=mid AND c.status<>'approved');
$$;
CREATE FUNCTION private.memory_visible(mid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.squad_memories m WHERE m.id=mid AND (
 m.author_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.memory_consents c WHERE c.memory_id=mid AND c.user_id=(SELECT auth.uid()))
 OR (private.is_squad_member(m.squad_id) AND private.memory_approved(mid))));
$$;
CREATE FUNCTION private.is_pulse_member(rid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.pulse_members pm WHERE pm.room_id=rid AND pm.user_id=(SELECT auth.uid()));
$$;
CREATE FUNCTION private.pulse_visible(rid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.pulse_rooms r WHERE r.id=rid AND (
 r.host_id=(SELECT auth.uid()) OR r.visibility='public'
 OR (r.visibility='community' AND private.is_community_member(r.community_id))
 OR (r.visibility='squad' AND private.is_squad_member(r.squad_id))));
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- Prevent changing owners or members through an allowed UPDATE.
CREATE FUNCTION private.keep_owners() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='universe_spaces' AND (NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR NEW.owner_squad_id IS DISTINCT FROM OLD.owner_squad_id) THEN RAISE EXCEPTION 'No puedes transferir propietarios'; END IF;
 IF TG_TABLE_NAME='pulse_rooms' AND (NEW.host_id IS DISTINCT FROM OLD.host_id OR NEW.visibility IS DISTINCT FROM OLD.visibility OR NEW.squad_id IS DISTINCT FROM OLD.squad_id OR NEW.community_id IS DISTINCT FROM OLD.community_id OR NEW.capacity IS DISTINCT FROM OLD.capacity OR NEW.expires_at IS DISTINCT FROM OLD.expires_at) THEN RAISE EXCEPTION 'No puedes cambiar la sala después de crearla'; END IF;
 IF TG_TABLE_NAME='squad_memories' AND (NEW.author_id IS DISTINCT FROM OLD.author_id OR NEW.squad_id IS DISTINCT FROM OLD.squad_id OR NEW.title IS DISTINCT FROM OLD.title OR NEW.story IS DISTINCT FROM OLD.story OR OLD.image_path IS NOT NULL) THEN RAISE EXCEPTION 'No puedes modificar recuerdos aprobados ni su contenido'; END IF;
 IF TG_TABLE_NAME='squad_memories' AND EXISTS(SELECT 1 FROM public.memory_consents mc WHERE mc.memory_id=OLD.id AND mc.status<>'pending') THEN RAISE EXCEPTION 'El recuerdo ya tiene decisiones de consentimiento'; END IF;
 IF TG_TABLE_NAME='chronicles' AND (NEW.community_id IS DISTINCT FROM OLD.community_id OR NEW.creator_id IS DISTINCT FROM OLD.creator_id OR NEW.chapter_no < OLD.chapter_no OR NEW.chapter_no > OLD.chapter_no+1) THEN RAISE EXCEPTION 'Capítulo o autor inválido'; END IF;
 IF TG_TABLE_NAME='memory_consents' AND (NEW.memory_id IS DISTINCT FROM OLD.memory_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN RAISE EXCEPTION 'Consentimiento intransferible'; END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER protect_universe BEFORE UPDATE ON public.universe_spaces FOR EACH ROW EXECUTE FUNCTION private.keep_owners();
CREATE TRIGGER protect_pulse BEFORE UPDATE ON public.pulse_rooms FOR EACH ROW EXECUTE FUNCTION private.keep_owners();
CREATE TRIGGER protect_memory BEFORE UPDATE ON public.squad_memories FOR EACH ROW EXECUTE FUNCTION private.keep_owners();
CREATE TRIGGER protect_chronicle BEFORE UPDATE ON public.chronicles FOR EACH ROW EXECUTE FUNCTION private.keep_owners();
CREATE TRIGGER protect_consent BEFORE UPDATE ON public.memory_consents FOR EACH ROW EXECUTE FUNCTION private.keep_owners();

-- Capacity enforced in PostgreSQL, not only visually in the client.
CREATE FUNCTION private.pulse_member_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.pulse_rooms%ROWTYPE; n integer;
BEGIN
 SELECT * INTO r FROM public.pulse_rooms WHERE id=NEW.room_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'open' OR r.expires_at<=now() THEN RAISE EXCEPTION 'La sala ya no está disponible'; END IF;
 IF r.visibility='community' AND NOT EXISTS(SELECT 1 FROM public.community_members WHERE community_id=r.community_id AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'No perteneces a esa comunidad'; END IF;
 IF r.visibility='squad' AND NOT EXISTS(SELECT 1 FROM public.squad_members WHERE squad_id=r.squad_id AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'No perteneces a ese squad'; END IF;
 SELECT count(*) INTO n FROM public.pulse_members WHERE room_id=NEW.room_id;
 IF n>=r.capacity THEN RAISE EXCEPTION 'La sala está llena'; END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER guard_pulse_capacity BEFORE INSERT ON public.pulse_members FOR EACH ROW EXECUTE FUNCTION private.pulse_member_guard();
CREATE FUNCTION private.add_pulse_host() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN INSERT INTO public.pulse_members(room_id,user_id) VALUES(NEW.id,NEW.host_id); RETURN NEW; END;$$;
CREATE TRIGGER add_pulse_host AFTER INSERT ON public.pulse_rooms FOR EACH ROW EXECUTE FUNCTION private.add_pulse_host();

CREATE INDEX portal_space_idx ON public.universe_portals(space_id);
CREATE INDEX memory_squad_idx ON public.squad_memories(squad_id,created_at DESC);
CREATE INDEX consent_user_idx ON public.memory_consents(user_id);
CREATE INDEX pulse_active_idx ON public.pulse_rooms(status,expires_at);
CREATE INDEX pulse_messages_room_idx ON public.pulse_messages(room_id,created_at DESC);
CREATE INDEX pulse_members_user_idx ON public.pulse_members(user_id);
CREATE INDEX chronicles_community_idx ON public.chronicles(community_id,created_at DESC);
CREATE INDEX chronicles_options_lookup_idx ON public.chronicle_options(chronicle_id,chapter_no);
CREATE INDEX chronicles_votes_option_idx ON public.chronicle_votes(option_id);

ALTER TABLE public.universe_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chronicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chronicle_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chronicle_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY spaces_read ON public.universe_spaces FOR SELECT TO authenticated USING (private.space_visible(id));
CREATE POLICY spaces_create ON public.universe_spaces FOR INSERT TO authenticated WITH CHECK (
 (owner_user_id=(SELECT auth.uid()) AND owner_squad_id IS NULL) OR
 (owner_user_id IS NULL AND EXISTS(SELECT 1 FROM public.squads WHERE id=owner_squad_id AND owner_id=(SELECT auth.uid()))));
CREATE POLICY spaces_edit ON public.universe_spaces FOR UPDATE TO authenticated USING(private.owns_space(id)) WITH CHECK(private.owns_space(id));
CREATE POLICY portals_read ON public.universe_portals FOR SELECT TO authenticated USING(private.space_visible(space_id));
CREATE POLICY portals_insert ON public.universe_portals FOR INSERT TO authenticated WITH CHECK(private.owns_space(space_id));
CREATE POLICY portals_delete ON public.universe_portals FOR DELETE TO authenticated USING(private.owns_space(space_id));
CREATE POLICY memories_read ON public.squad_memories FOR SELECT TO authenticated USING(private.memory_visible(id));
CREATE POLICY memories_add ON public.squad_memories FOR INSERT TO authenticated WITH CHECK(author_id=(SELECT auth.uid()) AND private.is_squad_member(squad_id));
CREATE POLICY memories_edit ON public.squad_memories FOR UPDATE TO authenticated USING(author_id=(SELECT auth.uid())) WITH CHECK(author_id=(SELECT auth.uid()));
CREATE POLICY memories_remove ON public.squad_memories FOR DELETE TO authenticated USING(author_id=(SELECT auth.uid()));
CREATE POLICY consents_read ON public.memory_consents FOR SELECT TO authenticated USING(private.memory_visible(memory_id));
CREATE POLICY consents_create ON public.memory_consents FOR INSERT TO authenticated WITH CHECK (
 status='pending' AND EXISTS(SELECT 1 FROM public.squad_memories m WHERE m.id=memory_id AND m.author_id=(SELECT auth.uid()) AND m.author_id<>user_id
 AND EXISTS(SELECT 1 FROM public.squad_members sm WHERE sm.squad_id=m.squad_id AND sm.user_id=memory_consents.user_id)));
CREATE POLICY consents_vote ON public.memory_consents FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid()) AND status='pending') WITH CHECK(user_id=(SELECT auth.uid()) AND status IN ('approved','declined'));
CREATE POLICY pulse_read ON public.pulse_rooms FOR SELECT TO authenticated USING(private.pulse_visible(id));
CREATE POLICY pulse_create ON public.pulse_rooms FOR INSERT TO authenticated WITH CHECK (
 host_id=(SELECT auth.uid()) AND status='open' AND expires_at>now() AND expires_at<=now()+interval '4 hours' AND
 (visibility='public' OR (visibility='community' AND private.is_community_member(community_id)) OR (visibility='squad' AND private.is_squad_member(squad_id))));
CREATE POLICY pulse_close ON public.pulse_rooms FOR UPDATE TO authenticated USING(host_id=(SELECT auth.uid())) WITH CHECK(host_id=(SELECT auth.uid()) AND status='closed');
CREATE POLICY pulse_members_read ON public.pulse_members FOR SELECT TO authenticated USING(private.pulse_visible(room_id));
CREATE POLICY pulse_members_join ON public.pulse_members FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND private.pulse_visible(room_id));
CREATE POLICY pulse_members_leave ON public.pulse_members FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY pulse_messages_read ON public.pulse_messages FOR SELECT TO authenticated USING(private.is_pulse_member(room_id));
CREATE POLICY pulse_messages_send ON public.pulse_messages FOR INSERT TO authenticated WITH CHECK(sender_id=(SELECT auth.uid()) AND private.is_pulse_member(room_id) AND EXISTS(SELECT 1 FROM public.pulse_rooms r WHERE r.id=room_id AND r.status='open' AND r.expires_at>now()));
CREATE POLICY chronicles_read ON public.chronicles FOR SELECT TO authenticated USING(private.is_community_member(community_id));
CREATE POLICY chronicles_insert ON public.chronicles FOR INSERT TO authenticated WITH CHECK(creator_id=(SELECT auth.uid()) AND private.is_community_staff(community_id));
CREATE POLICY chronicles_update ON public.chronicles FOR UPDATE TO authenticated USING(private.is_community_staff(community_id)) WITH CHECK(private.is_community_staff(community_id));
CREATE POLICY options_read ON public.chronicle_options FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.chronicles c WHERE c.id=chronicle_id AND private.is_community_member(c.community_id)));
CREATE POLICY options_insert ON public.chronicle_options FOR INSERT TO authenticated WITH CHECK(
 EXISTS(SELECT 1 FROM public.chronicles c WHERE c.id=chronicle_id AND private.is_community_staff(c.community_id)
 AND (chapter_no=c.chapter_no OR (c.status='closed' AND chapter_no=c.chapter_no+1))));
CREATE POLICY votes_read ON public.chronicle_votes FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.chronicles c WHERE c.id=chronicle_id AND private.is_community_member(c.community_id)));
CREATE POLICY votes_insert ON public.chronicle_votes FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND
 EXISTS(SELECT 1 FROM public.chronicles c WHERE c.id=chronicle_id AND c.chapter_no=chronicle_votes.chapter_no AND c.status='open'
 AND private.is_community_member(c.community_id)));

-- Explicit permissions; RLS handles row-level restrictions.
REVOKE ALL ON public.universe_spaces,public.universe_portals,public.squad_memories,public.memory_consents,public.pulse_rooms,public.pulse_members,public.pulse_messages,public.chronicles,public.chronicle_options,public.chronicle_votes FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.universe_spaces,public.universe_portals,public.squad_memories,public.memory_consents,public.pulse_rooms,public.pulse_members,public.pulse_messages,public.chronicles,public.chronicle_options,public.chronicle_votes TO authenticated;
-- Revoke unused operations (defense in depth).
REVOKE DELETE ON public.universe_spaces,public.pulse_rooms,public.chronicles,public.chronicle_options,public.chronicle_votes,public.memory_consents,public.pulse_messages FROM authenticated;
REVOKE UPDATE ON public.universe_portals,public.pulse_messages,public.chronicle_options,public.chronicle_votes,public.pulse_members FROM authenticated;

-- Private memory storage: never issue a public URL for a pending memory.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('gamvoraq-memories','gamvoraq-memories',false,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
CREATE POLICY gm_private_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='gamvoraq-memories' AND (storage.foldername(name))[2]=(SELECT auth.uid())::text
 AND EXISTS(SELECT 1 FROM public.squad_memories m WHERE m.id=private.safe_uuid((storage.foldername(name))[1]) AND m.author_id=(SELECT auth.uid())));
CREATE POLICY gm_private_read ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='gamvoraq-memories' AND private.memory_visible(private.safe_uuid((storage.foldername(name))[1])));

-- Realtime for the public or group-filtered room table. Avoid publishing members' location/activity.
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_rooms,public.pulse_messages;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
 END IF;
END $$;
COMMIT;
