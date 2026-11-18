-- GAMVORAQ · 017 · Recuerdos sin aprobación.
-- Antes: si mencionabas a alguien, el recuerdo quedaba «Pendiente de aprobación» hasta que aceptara.
-- Ahora: el recuerdo se comparte al momento con todo el squad. Las personas mencionadas solo aparecen como etiqueta.
-- Se puede ejecutar varias veces.
BEGIN;

-- Lo ve quien lo guardó y todos los integrantes del squad (también su foto, que usa esta misma función).
CREATE OR REPLACE FUNCTION private.memory_visible(mid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.squad_memories m WHERE m.id = mid
    AND (m.author_id = (SELECT auth.uid()) OR private.is_squad_member(m.squad_id)));
$$;
DROP POLICY IF EXISTS "memories_read" ON public.squad_memories;
CREATE POLICY "memories_read" ON public.squad_memories FOR SELECT TO authenticated
  USING (author_id = (SELECT auth.uid()) OR private.is_squad_member(squad_id));

-- Las menciones que estaban pendientes quedan como etiquetas (aprobadas).
UPDATE public.memory_consents SET status = 'approved', decided_at = coalesce(decided_at, now()) WHERE status = 'pending';

-- Protección de recuerdos: el contenido no se cambia, pero sí se puede poner la foto una vez (ya no depende de aprobaciones).
CREATE OR REPLACE FUNCTION private.keep_owners() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- Cada tabla se revisa por separado (antes se mezclaban campos de otras tablas y cualquier cambio fallaba).
  IF TG_TABLE_NAME = 'universe_spaces' THEN
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR NEW.owner_squad_id IS DISTINCT FROM OLD.owner_squad_id THEN RAISE EXCEPTION 'No puedes transferir propietarios'; END IF;
  ELSIF TG_TABLE_NAME = 'pulse_rooms' THEN
    IF NEW.host_id IS DISTINCT FROM OLD.host_id OR NEW.visibility IS DISTINCT FROM OLD.visibility OR NEW.squad_id IS DISTINCT FROM OLD.squad_id OR NEW.community_id IS DISTINCT FROM OLD.community_id OR NEW.capacity IS DISTINCT FROM OLD.capacity OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN RAISE EXCEPTION 'No puedes cambiar la sala después de crearla'; END IF;
  ELSIF TG_TABLE_NAME = 'squad_memories' THEN
    IF NEW.author_id IS DISTINCT FROM OLD.author_id OR NEW.squad_id IS DISTINCT FROM OLD.squad_id OR NEW.title IS DISTINCT FROM OLD.title OR NEW.story IS DISTINCT FROM OLD.story
       OR (OLD.image_path IS NOT NULL AND NEW.image_path IS DISTINCT FROM OLD.image_path) THEN RAISE EXCEPTION 'No puedes cambiar un recuerdo ya guardado'; END IF;
  ELSIF TG_TABLE_NAME = 'chronicles' THEN
    IF NEW.community_id IS DISTINCT FROM OLD.community_id OR NEW.creator_id IS DISTINCT FROM OLD.creator_id OR NEW.chapter_no < OLD.chapter_no OR NEW.chapter_no > OLD.chapter_no + 1 THEN RAISE EXCEPTION 'Capítulo o autor inválido'; END IF;
  ELSIF TG_TABLE_NAME = 'memory_consents' THEN
    IF NEW.memory_id IS DISTINCT FROM OLD.memory_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Mención intransferible'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- Guardar recuerdo: las menciones se guardan ya aprobadas.
CREATE OR REPLACE FUNCTION private.ensure_squad_member(sid uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid := (SELECT auth.uid());
BEGIN
  IF EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = sid AND user_id = uid) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.squads WHERE id = sid AND owner_id = uid) THEN
    INSERT INTO public.squad_members(squad_id, user_id, role) VALUES (sid, uid, 'owner') ON CONFLICT DO NOTHING; RETURN true;
  END IF;
  RETURN false;
END $$;
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
      INSERT INTO public.memory_consents(memory_id, user_id, status, decided_at) VALUES (r.id, who, 'approved', now()) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN to_jsonb(r);
END $$;
CREATE OR REPLACE FUNCTION public.set_memory_image(target uuid, path text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF path !~ ('^' || target::text || '/' || (SELECT auth.uid())::text || '/[A-Za-z0-9._-]+$') THEN RAISE EXCEPTION 'Ruta de imagen no válida'; END IF;
  UPDATE public.squad_memories SET image_path = path WHERE id = target AND author_id = (SELECT auth.uid()) AND image_path IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.create_squad_memory(jsonb), public.set_memory_image(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_squad_memory(jsonb), public.set_memory_image(uuid, text), private.ensure_squad_member(uuid), private.memory_visible(uuid) TO authenticated;
COMMIT;

SELECT 'Recuerdos sin aprobación' AS "Comprobación", '✓' AS "Estado";
