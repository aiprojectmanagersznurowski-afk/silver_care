-- Migration: 20261030170000_family_offboarding_retention_rls.sql
-- @REQ: FAM-DASHBOARD, @REQ: ADM-ARCHIVE (roles.contract.mjs OFFBOARDING_RETENTION_DAYS = 30)
-- Egzekwowanie 30-dniowego okna retencji po zgonie lub wypisie w warstwie RLS.
-- Po upływie 30 dni od zgonu/wypisu (lub natychmiast po archived_at) dostęp bliskich
-- (role 'family', 'legal_guardian') do danych podopiecznego w daily_reports, resident_media,
-- agenda_items, family_messages oraz residents zostaje bezwzględnie zablokowany.

-- 1. Funkcja pomocnicza sprawdzająca powiązanie i okno retencji podopiecznego dla bliskich
-- Utwardzona jako SECURITY DEFINER: jawny search_path, autentykacja z auth.uid(),
-- strefa Europe/Warsaw spójna z modułem TypeScript i kontraktem.
CREATE OR REPLACE FUNCTION public.is_relative_active_or_retained(target_resident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.resident_relative_links rrl
    JOIN public.residents r ON r.id = rrl.resident_id
    WHERE rrl.resident_id = target_resident_id
      AND rrl.relative_user_id = auth.uid()
      AND r.archived_at IS NULL
      AND (
        (r.death_date IS NULL AND r.contract_end_date IS NULL)
        -- roles.contract.mjs: OFFBOARDING_RETENTION_DAYS = 30
        OR (COALESCE(r.death_date, r.contract_end_date) + INTERVAL '30 days')::date > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Warsaw')::date
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.is_relative_active_or_retained(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_relative_active_or_retained(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_relative_active_or_retained(uuid) TO authenticated;

-- 2. Aktualizacja polityki SELECT na residents dla bliskich (ochrona przed odczytem po wygaśnięciu)
DROP POLICY IF EXISTS "residents_family_select" ON public.residents;

CREATE POLICY "residents_family_select" ON public.residents
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian') AND
    public.is_relative_active_or_retained(id)
  );

-- 3. Wąskie RPC do pobierania podstawowych danych powiązanego podopiecznego (imię, status, daty)
-- dla wygaszonego ekranu rodziny bez udostępniania wrażliwych kolumn tabeli residents.
CREATE OR REPLACE FUNCTION public.get_family_resident_overview()
RETURNS TABLE (
    id uuid,
    first_name text,
    last_name text,
    avatar_url text,
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
    r.avatar_url,
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

-- 4. Aktualizacja polityki SELECT na daily_reports dla bliskich
DROP POLICY IF EXISTS "Family can read published daily reports" ON public.daily_reports;

CREATE POLICY "Family can read published daily reports"
    ON public.daily_reports FOR SELECT TO authenticated
    USING (
        status = 'PUBLISHED'
        AND (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('family', 'legal_guardian')
        AND public.is_relative_active_or_retained(daily_reports.resident_id)
    );

-- 5. Aktualizacja polityki SELECT na resident_media dla bliskich
DROP POLICY IF EXISTS "Family can view linked resident media" ON public.resident_media;

CREATE POLICY "Family can view linked resident media"
    ON public.resident_media FOR SELECT
    USING (
        public.is_relative_active_or_retained(resident_media.resident_id)
    );

-- 6. Aktualizacja polityki SELECT na agenda_items dla bliskich
DROP POLICY IF EXISTS "agenda_items_family_select" ON public.agenda_items;

CREATE POLICY "agenda_items_family_select" ON public.agenda_items
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian') AND
    family_visible AND
    (
      (
        resident_id IS NULL AND
        EXISTS (
          SELECT 1 FROM public.resident_relative_links rrl
          JOIN public.residents r ON r.id = rrl.resident_id
          WHERE rrl.relative_user_id = auth.uid()
          AND r.organization_id = public.get_jwt_organization_id()
          AND r.archived_at IS NULL
          AND (
            (r.death_date IS NULL AND r.contract_end_date IS NULL)
            -- roles.contract.mjs: OFFBOARDING_RETENTION_DAYS = 30
            OR (COALESCE(r.death_date, r.contract_end_date) + INTERVAL '30 days')::date > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Warsaw')::date
          )
        )
      ) OR
      public.is_relative_active_or_retained(agenda_items.resident_id)
    )
  );

-- 7. Aktualizacja polityki SELECT i INSERT na family_messages dla bliskich
DROP POLICY IF EXISTS "family_messages_select" ON public.family_messages;

CREATE POLICY "family_messages_select" ON public.family_messages
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
      OR
      (
        COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian') AND
        relative_user_id = auth.uid() AND
        public.is_relative_active_or_retained(family_messages.resident_id)
      )
    )
  );

DROP POLICY IF EXISTS "family_messages_family_insert" ON public.family_messages;

CREATE POLICY "family_messages_family_insert" ON public.family_messages
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian') AND
    relative_user_id = auth.uid() AND
    is_from_family = true AND
    public.is_relative_active_or_retained(family_messages.resident_id)
  );
