-- Migration: 20261117120000_resident_photos_private_bucket.sql
-- @REQ: ADM-RESIDENT-PHOTO, @REQ: ORG-ISOLATION
--
-- SC-ADM-25 (decyzja Michała 2026-11-17): zdjęcia podopiecznych w prywatnym buckecie `resident-photos`.
-- Ścieżka pliku: <organization_id>/<resident_id>/<plik>. Zapis wyłącznie kierownik placówki dla podopiecznego
-- swojej placówki; odczyt personel tej placówki i bliscy z aktywnym powiązaniem lub w oknie retencji.
-- Aplikacja pokazuje zdjęcie przez krótkotrwały podpisany link (createSignedUrl), nie publiczny adres.
-- Addytywna: publiczny `avatars` i residents.avatar_url bez zmian do kroku przeniesienia plików (WO, krok 5–6).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resident-photos', 'resident-photos', false, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS photo_path text;
COMMENT ON COLUMN public.residents.photo_path IS 'Ścieżka zdjęcia w prywatnym buckecie resident-photos (<organization_id>/<resident_id>/<plik>); NULL = brak zdjęcia.';

-- Podopieczny ze ścieżki pliku, jeśli ścieżka ma postać <organization_id>/<resident_id>/... i oba segmenty są UUID
CREATE OR REPLACE FUNCTION public.resident_photo_target(p_name text)
RETURNS TABLE (organization_id uuid, resident_id uuid)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_parts text[] := string_to_array(p_name, '/');
BEGIN
  IF array_length(v_parts, 1) < 3 THEN
    RETURN;
  END IF;
  BEGIN
    organization_id := v_parts[1]::uuid;
    resident_id := v_parts[2]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN;
  END;
  RETURN NEXT;
END;
$function$;

-- Zapis: kierownik placówki, plik w folderze własnej placówki i jej podopiecznego
CREATE OR REPLACE FUNCTION public.resident_photo_writable(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'org_admin'
    AND EXISTS (
      SELECT 1
      FROM public.resident_photo_target(p_name) t
      JOIN public.residents r ON r.id = t.resident_id AND r.organization_id = t.organization_id
      WHERE t.organization_id = public.get_jwt_organization_id()
    );
$function$;

-- Odczyt: personel placówki podopiecznego albo bliski z aktywnym powiązaniem lub w oknie retencji
CREATE OR REPLACE FUNCTION public.resident_photo_readable(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.resident_photo_target(p_name) t
    JOIN public.residents r ON r.id = t.resident_id AND r.organization_id = t.organization_id
    WHERE t.organization_id = public.get_jwt_organization_id()
      AND (
        COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') IN ('org_admin', 'nurse')
        OR (
          COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') IN ('family', 'legal_guardian')
          AND public.is_relative_active_or_retained(t.resident_id)
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.resident_photo_writable(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resident_photo_readable(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resident_photo_writable(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resident_photo_readable(text) TO authenticated;

DROP POLICY IF EXISTS "resident_photos_select" ON storage.objects;
CREATE POLICY "resident_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resident-photos' AND public.resident_photo_readable(name));

DROP POLICY IF EXISTS "resident_photos_insert" ON storage.objects;
CREATE POLICY "resident_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resident-photos' AND public.resident_photo_writable(name));

DROP POLICY IF EXISTS "resident_photos_update" ON storage.objects;
CREATE POLICY "resident_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resident-photos' AND public.resident_photo_writable(name))
  WITH CHECK (bucket_id = 'resident-photos' AND public.resident_photo_writable(name));

DROP POLICY IF EXISTS "resident_photos_delete" ON storage.objects;
CREATE POLICY "resident_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resident-photos' AND public.resident_photo_writable(name));
