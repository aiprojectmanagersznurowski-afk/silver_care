-- Migration: 20261116210000_family_residents_no_table_read.sql
-- @REQ: FAM-RESIDENT-DATA-MINIMIZATION, @REQ: FAM-AGENDA
--
-- SC-FAM-08 (decyzja Michała 2026-11-16): bliscy (family, legal_guardian) nie odczytują tabeli residents.
-- Dotąd residents_family_select dawała cały wiersz (pesel_hash, is_zsn, care_level, notes, dane umowy,
-- ścieżka dokumentu umowy). Jedyną ścieżką pozostaje get_family_resident_overview() (7 jawnych kolumn).
--
-- KOLEJNOŚĆ (wspólna baza staging + produkcja): zastosować dopiero PO wdrożeniu kodu portalu rodziny,
-- który nie czyta residents bezpośrednio (WO-FAM-RESIDENT-DATA-MINIMIZATION, kroki 1–2).

-- 1. Plan dnia placówki (resident_id IS NULL) bez odczytu residents w kontekście bliskiego.
--    Ta sama reguła okna 30 dni co is_relative_active_or_retained (roles.contract.mjs: OFFBOARDING_RETENTION_DAYS = 30).
CREATE OR REPLACE FUNCTION public.family_has_active_link_in_org()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.resident_relative_links rrl
    JOIN public.residents r ON r.id = rrl.resident_id
    WHERE rrl.relative_user_id = auth.uid()
      AND r.organization_id = public.get_jwt_organization_id()
      AND r.archived_at IS NULL
      AND (
        (r.death_date IS NULL AND r.contract_end_date IS NULL)
        OR (COALESCE(r.death_date, r.contract_end_date) + INTERVAL '30 days')::date > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Warsaw')::date
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.family_has_active_link_in_org() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.family_has_active_link_in_org() FROM anon;
GRANT EXECUTE ON FUNCTION public.family_has_active_link_in_org() TO authenticated;

DROP POLICY IF EXISTS "agenda_items_family_select" ON public.agenda_items;
CREATE POLICY "agenda_items_family_select" ON public.agenda_items
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian') AND
    family_visible AND
    (
      (resident_id IS NULL AND public.family_has_active_link_in_org())
      OR public.is_relative_active_or_retained(agenda_items.resident_id)
    )
  );

-- 2. Tabela residents bez polityki odczytu dla ról bliskich.
DROP POLICY IF EXISTS "residents_family_select" ON public.residents;
