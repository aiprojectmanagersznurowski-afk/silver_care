-- Migration: 20261117130000_family_overview_photo_path.sql
-- @REQ: ADM-RESIDENT-PHOTO, @REQ: FAM-RESIDENT-DATA-MINIMIZATION
--
-- SC-ADM-25: get_family_resident_overview() zwraca photo_path (ścieżka w prywatnym buckecie resident-photos)
-- zamiast publicznego avatar_url — nadal 7 jawnych kolumn (SC-FAM-08). Portal rodziny podpisuje ścieżkę
-- krótkotrwałym linkiem; o odczycie decyduje polityka storage (bliski z aktywnym powiązaniem lub w retencji).
--
-- Kolejność: kod portalu obsługuje oba warianty odpowiedzi (avatar_url i photo_path), więc migrację można
-- zastosować przed albo po wdrożeniu kodu.

DROP FUNCTION IF EXISTS public.get_family_resident_overview();

CREATE FUNCTION public.get_family_resident_overview()
RETURNS TABLE (
    id uuid,
    first_name text,
    last_name text,
    photo_path text,
    death_date date,
    contract_end_date date,
    archived_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    r.id,
    r.first_name,
    r.last_name,
    r.photo_path,
    r.death_date,
    r.contract_end_date,
    r.archived_at
  FROM public.resident_relative_links rrl
  JOIN public.residents r ON r.id = rrl.resident_id
  WHERE rrl.relative_user_id = auth.uid()
    AND r.organization_id = public.get_jwt_organization_id();
$function$;

REVOKE ALL ON FUNCTION public.get_family_resident_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_family_resident_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_family_resident_overview() TO authenticated;
