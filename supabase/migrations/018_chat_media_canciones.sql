-- GAMVORAQ · 018 · Fotos y notas de voz en los chats + canciones completas.
-- 1) Mensajes privados y chats de squad pueden llevar una foto o una nota de voz.
--    Se guardan en un espacio PRIVADO (gamvoraq-chat): solo las personas de ese chat pueden verlas.
-- 2) Canciones del squad: se guarda el video de YouTube de cada canción para escucharla completa.
-- Se puede ejecutar varias veces.
BEGIN;

-- ═════ 1 · Adjuntos ═════
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS attachment_type text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS attachment_meta jsonb;
ALTER TABLE public.squad_messages ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.squad_messages ADD COLUMN IF NOT EXISTS attachment_type text;
ALTER TABLE public.squad_messages ADD COLUMN IF NOT EXISTS attachment_meta jsonb;
DO $$ BEGIN
  ALTER TABLE public.direct_messages ADD CONSTRAINT dm_attachment_type CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'audio'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.squad_messages ADD CONSTRAINT sm_attachment_type CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'audio'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Espacio privado para fotos y audios de los chats (máximo 8 MB por archivo).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gamvoraq-chat', 'gamvoraq-chat', false, 8388608,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/wav'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Ruta de cada archivo: <dm|squad>/<id del chat>/<tu id>/<archivo>
CREATE OR REPLACE FUNCTION private.chat_member(kind text, chat text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid := private.safe_uuid(chat); uid uuid := (SELECT auth.uid());
BEGIN
  IF cid IS NULL OR uid IS NULL THEN RETURN false; END IF;
  IF kind = 'dm' THEN RETURN EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = cid AND (c.user_low = uid OR c.user_high = uid)); END IF;
  IF kind = 'squad' THEN RETURN EXISTS (SELECT 1 FROM public.squad_members m WHERE m.squad_id = cid AND m.user_id = uid)
                            OR EXISTS (SELECT 1 FROM public.squads s WHERE s.id = cid AND s.owner_id = uid); END IF;
  RETURN false;
END $$;
GRANT EXECUTE ON FUNCTION private.chat_member(text, text) TO authenticated;

DROP POLICY IF EXISTS gvq_chat_upload ON storage.objects;
DROP POLICY IF EXISTS gvq_chat_read ON storage.objects;
DROP POLICY IF EXISTS gvq_chat_delete ON storage.objects;
CREATE POLICY gvq_chat_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'gamvoraq-chat' AND (storage.foldername(name))[3] = (SELECT auth.uid())::text
  AND private.chat_member((storage.foldername(name))[1], (storage.foldername(name))[2]));
CREATE POLICY gvq_chat_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'gamvoraq-chat' AND private.chat_member((storage.foldername(name))[1], (storage.foldername(name))[2]));
CREATE POLICY gvq_chat_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'gamvoraq-chat' AND (storage.foldername(name))[3] = (SELECT auth.uid())::text);

-- Enviar mensaje con o sin adjunto (privado o de squad). Valida que seas del chat y que el archivo sea tuyo y de ese chat.
CREATE OR REPLACE FUNCTION public.send_chat_message(kind text, target uuid, body_text text, att_path text DEFAULT NULL, att_type text DEFAULT NULL, att_meta jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid()); b text := left(trim(coalesce(body_text, '')), 2000); res jsonb; c public.conversations; other uuid;
  r1 public.direct_messages; r2 public.squad_messages;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión para escribir'; END IF;
  IF att_path IS NOT NULL THEN
    IF att_type NOT IN ('image', 'audio') THEN RAISE EXCEPTION 'Tipo de archivo no válido'; END IF;
    IF att_path !~ ('^' || kind || '/' || target::text || '/' || uid::text || '/[A-Za-z0-9._-]+$') THEN RAISE EXCEPTION 'Archivo no válido para este chat'; END IF;
    -- El texto nunca va vacío: si no escribiste nada, queda la etiqueta (se ve en avisos y vistas previas).
    IF b = '' THEN b := CASE att_type WHEN 'image' THEN '📷 Foto' ELSE '🎤 Mensaje de voz' END; END IF;
  ELSE att_type := NULL; att_meta := NULL;
  END IF;
  IF b = '' THEN RAISE EXCEPTION 'Escribe un mensaje'; END IF;

  IF kind = 'dm' THEN
    SELECT * INTO c FROM public.conversations WHERE id = target;
    IF NOT FOUND OR (c.user_low <> uid AND c.user_high <> uid) THEN RAISE EXCEPTION 'Esta conversación no es tuya'; END IF;
    other := CASE WHEN c.user_low = uid THEN c.user_high ELSE c.user_low END;
    IF NOT public.is_not_blocked(other) THEN RAISE EXCEPTION 'Hay un bloqueo entre ustedes'; END IF;
    IF to_regprocedure('private.can_interact(uuid,uuid)') IS NOT NULL AND NOT private.can_interact(c.user_low, c.user_high) THEN
      RAISE EXCEPTION 'Por protección de menores, no pueden escribirse en privado';
    END IF;
    INSERT INTO public.direct_messages(conversation_id, sender_id, body, attachment_path, attachment_type, attachment_meta)
    VALUES (target, uid, b, att_path, att_type, att_meta) RETURNING * INTO r1;
    res := to_jsonb(r1);
  ELSIF kind = 'squad' THEN
    IF NOT EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = target AND user_id = uid) THEN
      IF EXISTS (SELECT 1 FROM public.squads WHERE id = target AND owner_id = uid) THEN
        INSERT INTO public.squad_members(squad_id, user_id, role) VALUES (target, uid, 'owner') ON CONFLICT DO NOTHING;
      ELSE RAISE EXCEPTION 'Únete al squad para escribir en su chat'; END IF;
    END IF;
    INSERT INTO public.squad_messages(squad_id, sender_id, body, attachment_path, attachment_type, attachment_meta)
    VALUES (target, uid, b, att_path, att_type, att_meta) RETURNING * INTO r2;
    res := to_jsonb(r2);
  ELSE RAISE EXCEPTION 'Tipo de chat no válido'; END IF;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.send_chat_message(text, uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(text, uuid, text, text, text, jsonb) TO authenticated;

-- ═════ 2 · Canciones completas (video de YouTube) ═════
DO $$ BEGIN
  IF to_regclass('public.squad_tracks') IS NOT NULL THEN
    ALTER TABLE public.squad_tracks ADD COLUMN IF NOT EXISTS youtube_id text;
    BEGIN
      ALTER TABLE public.squad_tracks ADD CONSTRAINT tracks_youtube_id CHECK (youtube_id IS NULL OR youtube_id ~ '^[A-Za-z0-9_-]{11}$');
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
-- Cualquier integrante del squad puede guardar el video encontrado para una canción.
CREATE OR REPLACE FUNCTION public.set_track_video(track uuid, vid text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid;
BEGIN
  IF vid IS NOT NULL AND vid !~ '^[A-Za-z0-9_-]{11}$' THEN RAISE EXCEPTION 'Video no válido'; END IF;
  SELECT squad_id INTO sid FROM public.squad_tracks WHERE id = track;
  IF sid IS NULL OR NOT private.chat_member('squad', sid::text) THEN RAISE EXCEPTION 'Solo los integrantes del squad'; END IF;
  UPDATE public.squad_tracks SET youtube_id = vid WHERE id = track;
END $$;
REVOKE ALL ON FUNCTION public.set_track_video(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_track_video(uuid, text) TO authenticated;
COMMIT;

SELECT 'Fotos y audios en chats' AS "Comprobación",
       CASE WHEN to_regprocedure('public.send_chat_message(text,uuid,text,text,text,jsonb)') IS NOT NULL AND EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'gamvoraq-chat') THEN '✓' ELSE '✗' END AS "Estado"
UNION ALL SELECT 'Canciones completas', CASE WHEN to_regprocedure('public.set_track_video(uuid,text)') IS NOT NULL THEN '✓' ELSE '✗' END;
