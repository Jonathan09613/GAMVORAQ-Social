-- GAMVORAQ · 014 · «Marcar como leídas» funciona siempre.
-- Síntoma: al pulsar «Marcar como leídas» (o abrir un aviso) los avisos siguen como nuevos.
-- Causa: a la tabla de avisos le faltaba la regla para ACTUALIZAR; el cambio no daba error pero no se guardaba.
-- Arreglo: vuelve a poner esa regla y agrega una función del servidor que marca TUS avisos como leídos.
-- Se puede ejecutar varias veces.
BEGIN;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
DROP POLICY IF EXISTS "notifications_ack" ON public.notifications;
CREATE POLICY "notifications_ack" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
-- Las reglas RESTRICTIVAS de actualización no son de GAMVORAQ: se quitan.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND permissive = 'RESTRICTIVE' LOOP
    EXECUTE format('DROP POLICY %I ON public.notifications', p.policyname);
  END LOOP;
END $$;

-- ids = null → todos tus avisos sin leer; ids = lista → solo esos. Devuelve cuántos se marcaron.
CREATE OR REPLACE FUNCTION public.mark_notifications_read(ids uuid[] DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid()); n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
  UPDATE public.notifications SET read_at = now()
   WHERE user_id = uid AND read_at IS NULL AND (ids IS NULL OR id = ANY(ids));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;
COMMIT;

SELECT 'Marcar como leídas' AS "Comprobación", CASE WHEN to_regprocedure('public.mark_notifications_read(uuid[])') IS NOT NULL THEN '✓' ELSE '✗' END AS "Estado";
