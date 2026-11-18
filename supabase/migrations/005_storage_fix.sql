-- GAMVORAQ · Reparación del almacenamiento de imágenes («Bucket not found»).
-- Crea (o corrige) los dos espacios de archivos que usa la app y sus permisos.
-- Se puede ejecutar las veces que quieras: no borra imágenes ni datos.
--
--   gamvoraq           → avatares, portadas, publicaciones y galería (público)
--   gamvoraq-memories  → recuerdos de squad (privado, se ven solo con permiso)

-- 1. Espacio público de imágenes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gamvoraq', 'gamvoraq', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

-- Cada persona solo sube y borra dentro de su propia carpeta (su id de usuario).
DROP POLICY IF EXISTS "gamvoraq_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "gamvoraq_delete_own" ON storage.objects;
CREATE POLICY "gamvoraq_upload_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gamvoraq' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "gamvoraq_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gamvoraq' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- 2. Espacio privado de recuerdos (solo si ya existen las tablas de recuerdos de la migración 002)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gamvoraq-memories', 'gamvoraq-memories', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

DO $$
BEGIN
  IF to_regclass('public.squad_memories') IS NOT NULL
     AND to_regprocedure('private.memory_visible(uuid)') IS NOT NULL
     AND to_regprocedure('private.safe_uuid(text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS gm_private_upload ON storage.objects;
    DROP POLICY IF EXISTS gm_private_read ON storage.objects;
    CREATE POLICY gm_private_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (
      bucket_id = 'gamvoraq-memories' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
      AND EXISTS (SELECT 1 FROM public.squad_memories m WHERE m.id = private.safe_uuid((storage.foldername(name))[1]) AND m.author_id = (SELECT auth.uid())));
    CREATE POLICY gm_private_read ON storage.objects FOR SELECT TO authenticated USING (
      bucket_id = 'gamvoraq-memories' AND private.memory_visible(private.safe_uuid((storage.foldername(name))[1])));
  ELSE
    RAISE NOTICE 'Recuerdos: falta ejecutar 002_gamvoraq_universe.sql; el espacio público de imágenes ya quedó listo.';
  END IF;
END $$;

-- Comprobación: deben salir las dos filas.
SELECT id, public, file_size_limit FROM storage.buckets WHERE id IN ('gamvoraq', 'gamvoraq-memories') ORDER BY id;
