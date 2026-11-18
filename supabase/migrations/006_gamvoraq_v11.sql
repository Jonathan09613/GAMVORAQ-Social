-- GAMVORAQ v11 · Migración aditiva. Ejecutar DESPUÉS de 001-005. Se puede volver a ejecutar sin errores.
--
-- Qué agrega o corrige:
--   1. Menores: edad obligatoria para lo privado, año de nacimiento que no se puede cambiar a mano,
--      disponibilidad y saludos de la sala tranquila solo dentro del mismo rango de edad,
--      adultos no siguen a menores y los squads tienen rango de edad.
--   2. Squads: roles (dueño, admin, miembro), squads abiertos o por invitación, cupo, invitaciones,
--      expulsar, ascender, transferir, silenciar, máx. 5 squads creados por persona.
--   3. Mensajes: «Visto» y no leídos sincronizados entre dispositivos, borrar mensajes propios,
--      avisos agrupados por chat (un aviso por conversación, no uno por mensaje) y avisos del chat del squad.
--   4. Seguimientos: aviso con nombre, sin seguirse a sí mismo y bloquear deja de seguirse en ambos sentidos.
--   5. Retos: editar, cerrar y borrar; abandonar; avisos al enviar evidencia y al pedir ajustes; límite anti-spam.
--   6. Imágenes de juegos: portada de Steam automática, imagen subida por administradores de la app.
--   7. Notificaciones push: aviso de prueba y diagnóstico de la configuración.
BEGIN;

-- ═════════════════════════ 1. MENORES ═════════════════════════
-- Dos personas pueden interactuar en privado solo si las dos tienen edad registrada y están en el mismo rango.
CREATE OR REPLACE FUNCTION private.can_interact(a uuid, b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT private.age_band(a) <> 'unknown' AND private.age_band(b) <> 'unknown' AND private.same_age_band(a, b);
$$;
CREATE OR REPLACE FUNCTION public.private_ok(ids uuid[]) RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(array_agg(x), '{}') FROM unnest(ids[1:500]) AS x WHERE private.can_interact((SELECT auth.uid()), x);
$$;

-- El año de nacimiento se registra una vez. Cambiarlo después requiere soporte (evita que un menor se haga pasar por adulto).
CREATE OR REPLACE FUNCTION private.guard_birth_year() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF old.birth_year IS NOT NULL AND new.birth_year IS DISTINCT FROM old.birth_year
     AND coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'Tu año de nacimiento ya está registrado. Para corregirlo escribe a soporte.';
  END IF;
  IF new.birth_year IS NOT NULL AND (new.birth_year < 1900 OR new.birth_year > extract(year FROM now())::int - 7) THEN
    RAISE EXCEPTION 'Año de nacimiento no válido';
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_guard_birth_year ON public.profile_private;
CREATE TRIGGER trg_guard_birth_year BEFORE UPDATE ON public.profile_private FOR EACH ROW EXECUTE FUNCTION private.guard_birth_year();
DROP TRIGGER IF EXISTS trg_guard_birth_year_ins ON public.profile_private;
CREATE TRIGGER trg_guard_birth_year_ins BEFORE INSERT ON public.profile_private FOR EACH ROW EXECUTE FUNCTION private.guard_birth_year();

-- Mensajes privados: edad registrada y mismo rango.
DROP POLICY IF EXISTS "conversations_create" ON public.conversations;
CREATE POLICY "conversations_create" ON public.conversations FOR INSERT TO authenticated WITH CHECK (
  (user_low = (SELECT auth.uid()) OR user_high = (SELECT auth.uid()))
  AND public.is_not_blocked(CASE WHEN user_low = (SELECT auth.uid()) THEN user_high ELSE user_low END)
  AND private.can_interact(user_low, user_high));
DROP POLICY IF EXISTS "dms_send" ON public.direct_messages;
CREATE POLICY "dms_send" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = (SELECT auth.uid()) AND public.is_conversation_member(conversation_id)
  AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
              AND public.is_not_blocked(CASE WHEN c.user_low = (SELECT auth.uid()) THEN c.user_high ELSE c.user_low END)
              AND private.can_interact(c.user_low, c.user_high)));

-- «Disponible ahora»: un adulto no ve en tiempo real la actividad de un menor (ni al revés).
DROP POLICY IF EXISTS "availability_read" ON public.availability;
CREATE POLICY "availability_read" ON public.availability FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR (public.is_not_blocked(user_id) AND private.same_age_band((SELECT auth.uid()), user_id)));

-- Saludos de la sala tranquila: mismo rango de edad.
DROP POLICY IF EXISTS "waves_send" ON public.waves;
CREATE POLICY "waves_send" ON public.waves FOR INSERT TO authenticated WITH CHECK (
  from_id = (SELECT auth.uid()) AND public.is_not_blocked(to_id) AND private.can_interact(from_id, to_id)
  AND EXISTS (SELECT 1 FROM public.availability a WHERE a.user_id = to_id AND a.mode = 'silencioso' AND a.until > now()));

-- Guías: edad registrada y mismo rango.
DROP POLICY IF EXISTS "guide_requests_add" ON public.guide_requests;
CREATE POLICY "guide_requests_add" ON public.guide_requests FOR INSERT TO authenticated WITH CHECK (
  learner_id = (SELECT auth.uid()) AND status = 'pending' AND helpful IS NULL
  AND EXISTS (SELECT 1 FROM public.guide_offers o WHERE o.user_id = guide_id AND o.game_id = guide_requests.game_id)
  AND public.is_not_blocked(guide_id) AND private.can_interact(guide_id, learner_id));

-- Seguir: un adulto (o alguien sin edad registrada) no puede seguir a un menor. Nadie se sigue a sí mismo.
DROP POLICY IF EXISTS "follows_add" ON public.follows;
CREATE POLICY "follows_add" ON public.follows FOR INSERT TO authenticated WITH CHECK (
  follower_id = (SELECT auth.uid()) AND followed_id <> follower_id AND public.is_not_blocked(followed_id)
  AND (private.age_band(followed_id) <> 'minor' OR private.age_band(follower_id) = 'minor'));

-- ═════════════════════════ 2. SQUADS: ROLES, LÍMITES E INVITACIONES ═════════════════════════
ALTER TABLE public.squads ADD COLUMN IF NOT EXISTS privacy text NOT NULL DEFAULT 'abierto';
ALTER TABLE public.squads ADD COLUMN IF NOT EXISTS max_members integer NOT NULL DEFAULT 12;
ALTER TABLE public.squads ADD COLUMN IF NOT EXISTS age_band text;
DO $$ BEGIN
  ALTER TABLE public.squads ADD CONSTRAINT squads_privacy_chk CHECK (privacy IN ('abierto', 'invitacion'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.squads ADD CONSTRAINT squads_max_chk CHECK (max_members BETWEEN 2 AND 50);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE public.squads s SET age_band = private.age_band(s.owner_id) WHERE s.age_band IS NULL;

ALTER TABLE public.squad_members DROP CONSTRAINT IF EXISTS squad_members_role_check;
DO $$ BEGIN
  ALTER TABLE public.squad_members ADD CONSTRAINT squad_members_role_check CHECK (role IN ('owner', 'admin', 'member'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.squad_members ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.squad_role(sid uuid, uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT role FROM public.squad_members WHERE squad_id = sid AND user_id = uid;
$$;
CREATE OR REPLACE FUNCTION private.is_squad_staff(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(private.squad_role(sid, (SELECT auth.uid())) IN ('owner', 'admin'), false);
$$;
-- ¿Esta persona puede estar en el squad? Edad registrada, mismo rango que el squad y sin bloqueo con quien lo creó.
CREATE OR REPLACE FUNCTION private.squad_fits(sid uuid, uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.squads s WHERE s.id = sid
    AND private.age_band(uid) <> 'unknown'
    AND (s.age_band IS NULL OR s.age_band = 'unknown' OR s.age_band = private.age_band(uid))
    AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE (b.blocker_id = s.owner_id AND b.blocked_id = uid) OR (b.blocker_id = uid AND b.blocked_id = s.owner_id))
    AND (SELECT count(*) FROM public.squad_members m WHERE m.squad_id = sid) < s.max_members);
$$;

-- Al crear: rango de edad del dueño, edad obligatoria y máximo 5 squads creados por persona.
CREATE OR REPLACE FUNCTION private.before_squad() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    IF private.age_band(new.owner_id) = 'unknown' THEN RAISE EXCEPTION 'Registra tu año de nacimiento en tu perfil para crear squads'; END IF;
    IF (SELECT count(*) FROM public.squads WHERE owner_id = new.owner_id) >= 5 THEN RAISE EXCEPTION 'Puedes crear como máximo 5 squads'; END IF;
    new.age_band := private.age_band(new.owner_id);
  ELSE
    new.age_band := old.age_band;  -- el rango de edad no se puede cambiar
    IF coalesce(current_setting('gvq.transfer', true), '') <> 'on' THEN new.owner_id := old.owner_id; END IF;  -- dueño: solo con transfer_squad
    IF new.max_members < (SELECT count(*) FROM public.squad_members WHERE squad_id = new.id) THEN
      RAISE EXCEPTION 'El cupo no puede ser menor que los integrantes actuales';
    END IF;
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_before_squad ON public.squads;
CREATE TRIGGER trg_before_squad BEFORE INSERT OR UPDATE ON public.squads FOR EACH ROW EXECUTE FUNCTION private.before_squad();

-- Editar: dueño o admins. El dueño sigue siendo quien figura en owner_id (se cambia solo con transfer_squad).
DROP POLICY IF EXISTS "squads_edit" ON public.squads;
CREATE POLICY "squads_edit" ON public.squads FOR UPDATE TO authenticated USING (private.is_squad_staff(id)) WITH CHECK (private.is_squad_staff(id));
DROP POLICY IF EXISTS "squads_delete" ON public.squads;
CREATE POLICY "squads_delete" ON public.squads FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

-- Unirse por tu cuenta: solo a squads abiertos, con cupo y en tu rango de edad.
DROP POLICY IF EXISTS "squad_members_join" ON public.squad_members;
CREATE POLICY "squad_members_join" ON public.squad_members FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND role = 'member'
  AND EXISTS (SELECT 1 FROM public.squads s WHERE s.id = squad_id AND s.privacy = 'abierto')
  AND private.squad_fits(squad_id, user_id));
-- Salir (integrantes y admins) o expulsar (dueño a cualquiera; admin solo a integrantes).
DROP POLICY IF EXISTS "squad_members_leave" ON public.squad_members;
CREATE POLICY "squad_members_leave" ON public.squad_members FOR DELETE TO authenticated USING (
  (user_id = (SELECT auth.uid()) AND role <> 'owner')
  OR (role <> 'owner' AND private.squad_role(squad_id, (SELECT auth.uid())) = 'owner')
  OR (role = 'member' AND private.squad_role(squad_id, (SELECT auth.uid())) = 'admin'));
-- Silenciar avisos del chat (cada quien el suyo) y cambiar roles (solo el dueño, entre admin y miembro).
DROP POLICY IF EXISTS "squad_members_update" ON public.squad_members;
CREATE POLICY "squad_members_update" ON public.squad_members FOR UPDATE TO authenticated USING (
  user_id = (SELECT auth.uid()) OR private.squad_role(squad_id, (SELECT auth.uid())) = 'owner')
  WITH CHECK (user_id = (SELECT auth.uid()) OR private.squad_role(squad_id, (SELECT auth.uid())) = 'owner');

-- Avisos de rol y expulsión.
CREATE OR REPLACE FUNCTION private.on_member_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sname text; me uuid := (SELECT auth.uid());
BEGIN
  IF tg_op = 'DELETE' THEN
    SELECT name INTO sname FROM public.squads WHERE id = old.squad_id;
    IF sname IS NOT NULL AND me IS NOT NULL AND me <> old.user_id THEN
      INSERT INTO public.notifications(user_id, actor_id, kind, body, ref_id) VALUES (old.user_id, me, 'squad', 'Ya no formas parte de ' || sname, old.squad_id);
    END IF;
    RETURN old;
  END IF;
  IF new.role IS DISTINCT FROM old.role THEN
    SELECT name INTO sname FROM public.squads WHERE id = new.squad_id;
    INSERT INTO public.notifications(user_id, actor_id, kind, body, ref_id) VALUES (new.user_id, me, 'squad',
      CASE new.role WHEN 'admin' THEN 'Ahora eres admin de ' WHEN 'owner' THEN 'Ahora eres dueño de ' ELSE 'Ya no eres admin de ' END || coalesce(sname, 'tu squad'), new.squad_id);
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_member_change ON public.squad_members;
CREATE TRIGGER trg_member_change AFTER UPDATE OR DELETE ON public.squad_members FOR EACH ROW EXECUTE FUNCTION private.on_member_change();

-- Transferir el squad a otra persona del squad (el anterior dueño queda como admin).
CREATE OR REPLACE FUNCTION public.transfer_squad(sid uuid, new_owner uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid := (SELECT auth.uid());
BEGIN
  IF private.squad_role(sid, me) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Solo el dueño puede transferir el squad'; END IF;
  IF new_owner = me OR private.squad_role(sid, new_owner) IS NULL THEN RAISE EXCEPTION 'Elige a alguien del squad'; END IF;
  IF (SELECT count(*) FROM public.squads WHERE owner_id = new_owner) >= 5 THEN RAISE EXCEPTION 'Esa persona ya tiene 5 squads'; END IF;
  PERFORM set_config('gvq.transfer', 'on', true);
  UPDATE public.squad_members SET role = 'admin' WHERE squad_id = sid AND user_id = me;
  UPDATE public.squad_members SET role = 'owner' WHERE squad_id = sid AND user_id = new_owner;
  UPDATE public.squads SET owner_id = new_owner WHERE id = sid;
END $$;
-- Quién cambia qué en los integrantes (deja pasar la transferencia hecha por transfer_squad).
CREATE OR REPLACE FUNCTION private.guard_member_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid := (SELECT auth.uid());
BEGIN
  IF me IS NULL OR current_setting('gvq.transfer', true) = 'on' THEN RETURN new; END IF;
  IF new.squad_id <> old.squad_id OR new.user_id <> old.user_id OR new.joined_at <> old.joined_at THEN RAISE EXCEPTION 'Cambio no permitido'; END IF;
  IF new.role IS DISTINCT FROM old.role THEN
    IF private.squad_role(old.squad_id, me) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Solo el dueño cambia roles'; END IF;
    IF old.role = 'owner' OR new.role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'Para cambiar de dueño usa «Transferir»'; END IF;
  END IF;
  IF new.muted IS DISTINCT FROM old.muted AND old.user_id <> me THEN RAISE EXCEPTION 'Solo tú decides si silencias el squad'; END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_guard_member_update ON public.squad_members;
CREATE TRIGGER trg_guard_member_update BEFORE UPDATE ON public.squad_members FOR EACH ROW EXECUTE FUNCTION private.guard_member_update();
REVOKE ALL ON FUNCTION public.transfer_squad(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_squad(uuid, uuid) TO authenticated;

-- Invitaciones: dueño o admins invitan; la persona acepta o rechaza.
CREATE TABLE IF NOT EXISTS public.squad_invites (
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (squad_id, user_id)
);
ALTER TABLE public.squad_invites ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.squad_invites TO authenticated;
DROP POLICY IF EXISTS "squad_invites_read" ON public.squad_invites;
DROP POLICY IF EXISTS "squad_invites_add" ON public.squad_invites;
DROP POLICY IF EXISTS "squad_invites_remove" ON public.squad_invites;
CREATE POLICY "squad_invites_read" ON public.squad_invites FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR private.is_squad_staff(squad_id));
CREATE POLICY "squad_invites_add" ON public.squad_invites FOR INSERT TO authenticated WITH CHECK (
  invited_by = (SELECT auth.uid()) AND private.is_squad_staff(squad_id) AND private.squad_role(squad_id, user_id) IS NULL
  AND public.is_not_blocked(user_id) AND private.squad_fits(squad_id, user_id));
CREATE POLICY "squad_invites_remove" ON public.squad_invites FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()) OR private.is_squad_staff(squad_id));
CREATE OR REPLACE FUNCTION private.on_squad_invite() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.notifications(user_id, actor_id, kind, body, ref_id)
  SELECT new.user_id, new.invited_by, 'squad_invite', coalesce(p.display_name, 'Alguien') || ' te invitó a ' || s.name, new.squad_id
  FROM public.squads s LEFT JOIN public.profiles p ON p.id = new.invited_by WHERE s.id = new.squad_id;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_squad_invite ON public.squad_invites;
CREATE TRIGGER trg_squad_invite AFTER INSERT ON public.squad_invites FOR EACH ROW EXECUTE FUNCTION private.on_squad_invite();
CREATE OR REPLACE FUNCTION public.accept_squad_invite(sid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid := (SELECT auth.uid());
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.squad_invites WHERE squad_id = sid AND user_id = me) THEN RAISE EXCEPTION 'La invitación ya no existe'; END IF;
  IF NOT private.squad_fits(sid, me) THEN RAISE EXCEPTION 'No puedes unirte: el squad está lleno o no corresponde a tu rango de edad'; END IF;
  INSERT INTO public.squad_members(squad_id, user_id, role) VALUES (sid, me, 'member') ON CONFLICT DO NOTHING;
  DELETE FROM public.squad_invites WHERE squad_id = sid AND user_id = me;
END $$;
REVOKE ALL ON FUNCTION public.accept_squad_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_squad_invite(uuid) TO authenticated;

-- Agendar partidas del squad: solo dueño y admins (las partidas abiertas al público siguen igual).
DROP POLICY IF EXISTS "sessions_add" ON public.play_sessions;
CREATE POLICY "sessions_add" ON public.play_sessions FOR INSERT TO authenticated WITH CHECK (
  host_id = (SELECT auth.uid()) AND status = 'scheduled'
  AND starts_at > now() - interval '10 minutes' AND starts_at < now() + interval '60 days'
  AND (squad_id IS NULL OR private.is_squad_staff(squad_id))
  AND (squad_id IS NOT NULL OR NOT private.has_open_strike((SELECT auth.uid()))));
-- Admins también pueden cancelar partidas del squad.
DROP POLICY IF EXISTS "sessions_edit" ON public.play_sessions;
CREATE POLICY "sessions_edit" ON public.play_sessions FOR UPDATE TO authenticated
  USING (host_id = (SELECT auth.uid()) OR (squad_id IS NOT NULL AND private.is_squad_staff(squad_id)))
  WITH CHECK (host_id = (SELECT auth.uid()) OR (squad_id IS NOT NULL AND private.is_squad_staff(squad_id)));

-- Ligas: dueño o admins inscriben al squad.
DROP POLICY IF EXISTS "league_teams_add" ON public.league_teams;
CREATE POLICY "league_teams_add" ON public.league_teams FOR INSERT TO authenticated WITH CHECK (
  registered_by = (SELECT auth.uid()) AND private.is_squad_staff(squad_id)
  AND EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.status = 'inscripciones'));

-- ═════════════════════════ 3. MENSAJES ═════════════════════════
-- Hasta dónde leyó cada persona: «Visto» y no leídos iguales en todos sus dispositivos.
CREATE TABLE IF NOT EXISTS public.chat_reads (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_kind text NOT NULL CHECK (chat_kind IN ('dm', 'squad')),
  chat_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chat_kind, chat_id)
);
ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.chat_reads TO authenticated;
DROP POLICY IF EXISTS "chat_reads_read" ON public.chat_reads;
DROP POLICY IF EXISTS "chat_reads_write" ON public.chat_reads;
DROP POLICY IF EXISTS "chat_reads_update" ON public.chat_reads;
-- Ves tus marcas y las de la otra persona de tus chats privados (para el «Visto»).
CREATE POLICY "chat_reads_read" ON public.chat_reads FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR (chat_kind = 'dm' AND public.is_conversation_member(chat_id)));
CREATE POLICY "chat_reads_write" ON public.chat_reads FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND ((chat_kind = 'dm' AND public.is_conversation_member(chat_id)) OR (chat_kind = 'squad' AND public.is_squad_member(chat_id))));
CREATE POLICY "chat_reads_update" ON public.chat_reads FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
-- Al leer un chat, sus avisos de «mensaje nuevo» se marcan como leídos.
CREATE OR REPLACE FUNCTION private.on_chat_read() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.notifications SET read_at = now() WHERE user_id = new.user_id AND read_at IS NULL AND ref_id = new.chat_id AND kind IN ('message', 'squad_message');
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_chat_read ON public.chat_reads;
CREATE TRIGGER trg_chat_read AFTER INSERT OR UPDATE ON public.chat_reads FOR EACH ROW EXECUTE FUNCTION private.on_chat_read();

-- Borrar tus propios mensajes. En el squad, el dueño y los admins pueden borrar cualquiera (moderación).
DROP POLICY IF EXISTS "dms_delete_own" ON public.direct_messages;
CREATE POLICY "dms_delete_own" ON public.direct_messages FOR DELETE TO authenticated USING (sender_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "squad_messages_delete" ON public.squad_messages;
CREATE POLICY "squad_messages_delete" ON public.squad_messages FOR DELETE TO authenticated USING (sender_id = (SELECT auth.uid()) OR private.is_squad_staff(squad_id));
GRANT DELETE ON public.direct_messages, public.squad_messages TO authenticated;

-- Un solo aviso por conversación mientras no lo leas: se actualiza con el último mensaje (y vuelve a sonar).
CREATE OR REPLACE FUNCTION private.upsert_chat_notice(target uuid, actor uuid, k text, msg text, ref uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE nid uuid;
BEGIN
  SELECT id INTO nid FROM public.notifications WHERE user_id = target AND kind = k AND ref_id = ref AND read_at IS NULL ORDER BY created_at DESC LIMIT 1;
  IF nid IS NULL THEN
    INSERT INTO public.notifications(user_id, actor_id, kind, body, ref_id) VALUES (target, actor, k, msg, ref);
  ELSE
    UPDATE public.notifications SET body = msg, actor_id = actor, created_at = now() WHERE id = nid;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.on_new_dm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE recipient uuid; who text;
BEGIN
  SELECT CASE WHEN user_low = new.sender_id THEN user_high ELSE user_low END INTO recipient FROM public.conversations WHERE id = new.conversation_id;
  SELECT display_name INTO who FROM public.profiles WHERE id = new.sender_id;
  PERFORM private.upsert_chat_notice(recipient, new.sender_id, 'message', coalesce(who, 'Alguien') || ': ' || left(new.body, 90), new.conversation_id);
  RETURN new;
END $$;
CREATE OR REPLACE FUNCTION private.on_squad_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who text; sname text; m record;
BEGIN
  SELECT display_name INTO who FROM public.profiles WHERE id = new.sender_id;
  SELECT name INTO sname FROM public.squads WHERE id = new.squad_id;
  FOR m IN SELECT user_id FROM public.squad_members WHERE squad_id = new.squad_id AND user_id <> new.sender_id AND NOT muted LOOP
    PERFORM private.upsert_chat_notice(m.user_id, new.sender_id, 'squad_message', coalesce(sname, 'Squad') || ' · ' || coalesce(who, 'Alguien') || ': ' || left(new.body, 80), new.squad_id);
  END LOOP;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_squad_message ON public.squad_messages;
CREATE TRIGGER trg_squad_message AFTER INSERT ON public.squad_messages FOR EACH ROW EXECUTE FUNCTION private.on_squad_message();

-- ═════════════════════════ 4. SEGUIMIENTOS ═════════════════════════
CREATE OR REPLACE FUNCTION public.on_new_follow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who text; back boolean;
BEGIN
  SELECT display_name INTO who FROM public.profiles WHERE id = new.follower_id;
  back := EXISTS (SELECT 1 FROM public.follows WHERE follower_id = new.followed_id AND followed_id = new.follower_id);
  INSERT INTO public.notifications(user_id, actor_id, kind, body)
  VALUES (new.followed_id, new.follower_id, 'follow', coalesce(who, 'Alguien') || CASE WHEN back THEN ' también te sigue. ¡Ya se siguen mutuamente!' ELSE ' comenzó a seguirte' END);
  RETURN new;
END $$;
-- Bloquear deja de seguirse en ambos sentidos y cancela invitaciones a squads entre ustedes.
CREATE OR REPLACE FUNCTION private.on_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  DELETE FROM public.follows WHERE (follower_id = new.blocker_id AND followed_id = new.blocked_id) OR (follower_id = new.blocked_id AND followed_id = new.blocker_id);
  DELETE FROM public.squad_invites WHERE (user_id = new.blocked_id AND invited_by = new.blocker_id) OR (user_id = new.blocker_id AND invited_by = new.blocked_id);
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_on_block ON public.blocks;
CREATE TRIGGER trg_on_block AFTER INSERT ON public.blocks FOR EACH ROW EXECUTE FUNCTION private.on_block();
DELETE FROM public.follows f WHERE f.follower_id = f.followed_id;

-- ═════════════════════════ 5. RETOS DE COMUNIDAD ═════════════════════════
CREATE OR REPLACE FUNCTION private.can_manage_quest(qid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.quests q WHERE q.id = qid AND (q.creator_id = (SELECT auth.uid()) OR (q.community_id IS NOT NULL AND public.is_community_staff(q.community_id))));
$$;
DROP POLICY IF EXISTS "quests_edit" ON public.quests;
DROP POLICY IF EXISTS "quests_delete" ON public.quests;
CREATE POLICY "quests_edit" ON public.quests FOR UPDATE TO authenticated USING (private.can_manage_quest(id)) WITH CHECK (private.can_manage_quest(id));
CREATE POLICY "quests_delete" ON public.quests FOR DELETE TO authenticated USING (private.can_manage_quest(id));
GRANT UPDATE, DELETE ON public.quests TO authenticated;
CREATE OR REPLACE FUNCTION private.guard_quest() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    -- Anti-spam: máximo 3 retos abiertos por persona.
    IF (SELECT count(*) FROM public.quests WHERE creator_id = new.creator_id AND (ends_at IS NULL OR ends_at > now())) >= 3 THEN
      RAISE EXCEPTION 'Tienes 3 retos abiertos. Cierra uno para crear otro';
    END IF;
  ELSE
    new.creator_id := old.creator_id; new.community_id := old.community_id; new.created_at := old.created_at;
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_guard_quest ON public.quests;
CREATE TRIGGER trg_guard_quest BEFORE INSERT OR UPDATE ON public.quests FOR EACH ROW EXECUTE FUNCTION private.guard_quest();
-- Abandonar un reto (si aún no está aprobado).
DROP POLICY IF EXISTS "quest_entries_leave" ON public.quest_entries;
CREATE POLICY "quest_entries_leave" ON public.quest_entries FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()) AND status IN ('joined', 'rejected', 'submitted'));
GRANT DELETE ON public.quest_entries TO authenticated;
-- Avisos: a quien revisa cuando llega evidencia; a quien participa cuando le piden ajustes.
CREATE OR REPLACE FUNCTION private.on_quest_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q record; who text;
BEGIN
  SELECT * INTO q FROM public.quests WHERE id = new.quest_id;
  IF new.status = 'submitted' AND old.status IS DISTINCT FROM 'submitted' THEN
    SELECT display_name INTO who FROM public.profiles WHERE id = new.user_id;
    INSERT INTO public.notifications(user_id, actor_id, kind, body, ref_id)
    VALUES (q.creator_id, new.user_id, 'quest_review', coalesce(who, 'Alguien') || ' envió evidencia para «' || q.title || '»', new.quest_id);
  ELSIF new.status = 'rejected' AND old.status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications(user_id, kind, body, ref_id)
    VALUES (new.user_id, 'quest', 'Te pidieron ajustes en «' || q.title || '». Puedes volver a enviar tu evidencia.', new.quest_id);
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_quest_entry ON public.quest_entries;
CREATE TRIGGER trg_quest_entry AFTER UPDATE ON public.quest_entries FOR EACH ROW EXECUTE FUNCTION private.on_quest_entry();

-- ═════════════════════════ 6. IMÁGENES DE JUEGOS ═════════════════════════
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS steam_appid integer;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS image_url text;
-- Administradores de la app (los agregas tú con SQL; ver la guía).
CREATE TABLE IF NOT EXISTS public.app_admins (user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_admins FROM anon, authenticated;
CREATE OR REPLACE FUNCTION private.is_app_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = (SELECT auth.uid()));
$$;
CREATE OR REPLACE FUNCTION public.am_i_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT private.is_app_admin(); $$;
GRANT EXECUTE ON FUNCTION public.am_i_admin() TO authenticated;
GRANT INSERT, UPDATE ON public.games TO authenticated;
DROP POLICY IF EXISTS "games_admin_add" ON public.games;
DROP POLICY IF EXISTS "games_admin_edit" ON public.games;
CREATE POLICY "games_admin_add" ON public.games FOR INSERT TO authenticated WITH CHECK (private.is_app_admin());
CREATE POLICY "games_admin_edit" ON public.games FOR UPDATE TO authenticated USING (private.is_app_admin()) WITH CHECK (private.is_app_admin());
-- Los administradores suben portadas a la carpeta games/ del espacio público de imágenes.
DROP POLICY IF EXISTS "gamvoraq_admin_games" ON storage.objects;
CREATE POLICY "gamvoraq_admin_games" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gamvoraq' AND (storage.foldername(name))[1] = 'games' AND private.is_app_admin());

-- Portadas de Steam para los juegos más conocidos del catálogo (número de aplicación de la tienda de Steam).
UPDATE public.games g SET steam_appid = v.appid FROM (VALUES
  ('Counter-Strike 2', 730), ('Dota 2', 570), ('Apex Legends', 1172470), ('Rust', 252490), ('Terraria', 105600),
  ('Stardew Valley', 413150), ('Valheim', 892970), ('Among Us', 945360), ('Phasmophobia', 739630), ('Dead by Daylight', 381210),
  ('Lethal Company', 1966720), ('It Takes Two', 1426210), ('Palworld', 1623730), ('Deep Rock Galactic', 548430), ('Helldivers 2', 553850),
  ('Elden Ring', 1245620), ('Hollow Knight', 367520), ('Hades', 1145360), ('Hades II', 1145350), ('Celeste', 504230), ('Cuphead', 268910),
  ('Baldur''s Gate 3', 1086940), ('Cyberpunk 2077', 1091500), ('The Witcher 3', 292030), ('Skyrim', 489830), ('Fallout 4', 377160),
  ('Grand Theft Auto V', 271590), ('Red Dead Redemption 2', 1174180), ('Team Fortress 2', 440), ('Left 4 Dead 2', 550), ('Portal 2', 620),
  ('Garry''s Mod', 4000), ('Factorio', 427520), ('Satisfactory', 526870), ('Subnautica', 264710), ('Raft', 648800), ('No Man''s Sky', 275850),
  ('Sea of Thieves', 1172620), ('Destiny 2', 1085660), ('Warframe', 230410), ('Path of Exile', 238960), ('Monster Hunter World', 582010),
  ('Monster Hunter Rise', 1446780), ('Sekiro: Shadows Die Twice', 814380), ('Dark Souls III', 374320), ('Undertale', 391540),
  ('Slay the Spire', 646570), ('Balatro', 2379780), ('Vampire Survivors', 1794680), ('Risk of Rain 2', 632360), ('Cult of the Lamb', 1313140),
  ('Don''t Starve Together', 322330), ('Project Zomboid', 108600), ('7 Days to Die', 251570), ('The Forest', 242760), ('Sons of the Forest', 1326470),
  ('Fall Guys', 1097150), ('PUBG: Battlegrounds', 578080), ('Rainbow Six Siege', 359550), ('Overcooked! 2', 728880), ('Human: Fall Flat', 477160),
  ('Golf With Your Friends', 431240), ('Gang Beasts', 285900), ('Content Warning', 2881650), ('The Finals', 2073850), ('Marvel Rivals', 2767030),
  ('Geometry Dash', 322170), ('Black Desert Online', 582660), ('Lost Ark', 1599340), ('Grounded', 962130), ('Core Keeper', 1621690),
  ('Enter the Gungeon', 311690), ('Binding of Isaac: Rebirth', 250900), ('Inscryption', 1092790), ('Dying Light 2', 534380),
  ('Payday 3', 1272080), ('Ready or Not', 1144200), ('Insurgency: Sandstorm', 581320), ('PlateUp!', 1599600), ('Keep Talking and Nobody Explodes', 341800),
  ('Civilization VI', 289070), ('Age of Empires II: Definitive Edition', 813780), ('Age of Empires IV', 1466860), ('Cities: Skylines II', 949230),
  ('Bloons TD 6', 960090), ('Brawlhalla', 291550), ('Tekken 8', 1778820), ('Street Fighter 6', 1364780), ('Mortal Kombat 1', 1971870),
  ('Dragon Ball FighterZ', 678950), ('Yu-Gi-Oh! Master Duel', 1449850), ('Final Fantasy XIV', 39210), ('Guild Wars 2', 1284210),
  ('The Elder Scrolls Online', 306130), ('Diablo IV', 2344520), ('Path of Exile 2', 2694490), ('Starfield', 1716740), ('Forza Horizon 5', 1551360),
  ('Assetto Corsa Competizione', 805550), ('Fallout 76', 1151340), ('Persona 5 Royal', 1687950), ('Deltarune', 1671210),
  ('Monster Hunter Wilds', 2246340), ('Hunt: Showdown 1896', 594650), ('Battlefield 2042', 1517290), ('Overwatch 2', 2357570), ('eFootball', 1665460),
  ('Back 4 Blood', 924970), ('Pummel Party', 880940), ('Party Animals', 1260320), ('VRChat', 438100), ('Rec Room', 471710),
  ('Gorilla Tag', 1533390), ('Beat Saber', 620980), ('Ori and the Will of the Wisps', 1057090), ('Marvel Snap', 1997040), ('A Way Out', 1222700),
  ('ARK: Survival Ascended', 2399830), ('DayZ', 221100), ('Rocket League', 252950), ('Dinkum', 1062520), ('Unrailed!', 1016920), ('Chained Together', 2567870)
) AS v(name, appid) WHERE g.name = v.name AND g.steam_appid IS NULL;

-- ═════════════════════════ 7. NOTIFICACIONES PUSH ═════════════════════════
-- Un aviso agrupado que se actualiza también vuelve a sonar en el teléfono.
DROP TRIGGER IF EXISTS trg_push_notification ON public.notifications;
DROP TRIGGER IF EXISTS trg_push_notification_upd ON public.notifications;
DO $$ BEGIN
  IF to_regprocedure('private.push_notification()') IS NOT NULL THEN
    EXECUTE 'CREATE TRIGGER trg_push_notification AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION private.push_notification()';
    EXECUTE 'CREATE TRIGGER trg_push_notification_upd AFTER UPDATE OF created_at ON public.notifications FOR EACH ROW WHEN (new.read_at IS NULL AND new.created_at > old.created_at) EXECUTE FUNCTION private.push_notification()';
  END IF;
END $$;
-- ¿Está todo listo para que lleguen los avisos? (no revela la configuración, solo si existe)
CREATE OR REPLACE FUNCTION public.push_check() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'pg_net', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net'),
    'url', EXISTS (SELECT 1 FROM private.settings WHERE key = 'push_url' AND value LIKE 'https://%'),
    'secret', EXISTS (SELECT 1 FROM private.settings WHERE key = 'push_secret' AND length(value) >= 16),
    'devices', (SELECT count(*) FROM public.push_subscriptions WHERE user_id = (SELECT auth.uid())));
$$;
-- Aviso de prueba para ti mismo (máximo uno por minuto).
CREATE OR REPLACE FUNCTION public.test_push() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid := (SELECT auth.uid());
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id = me AND kind = 'test' AND created_at > now() - interval '1 minute') THEN
    RAISE EXCEPTION 'Espera un minuto para otra prueba';
  END IF;
  INSERT INTO public.notifications(user_id, kind, body) VALUES (me, 'test', '¡Las notificaciones de GAMVORAQ funcionan en este dispositivo! 🎮');
END $$;
REVOKE ALL ON FUNCTION public.push_check(), public.test_push() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_check(), public.test_push() TO authenticated;

-- Tiempo real para las tablas nuevas.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_invites; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reads; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

COMMIT;
