-- Migration: 20261030170000_family_offboarding_retention_rls.sql
-- @REQ: FAM-DASHBOARD, @REQ: SEC-RETENTION (roles.contract.mjs OFFBOARDING_RETENTION_DAYS = 30)
-- Egzekwowanie 30-dniowego okna retencji po zgonie lub wypisie w warstwie RLS.
-- Po upływie 30 dni od zgonu/wypisu (lub natychmiast po archived_at) dostęp bliskich
-- (role 'family', 'legal_guardian') do danych podopiecznego w daily_reports, resident_media,
-- agenda_items i family_messages zostaje bezwzględnie zablokowany.

-- 1. Funkcja pomocnicza sprawdzająca powiązanie i okno retencji podopiecznego dla bliskich
CREATE OR REPLACE FUNCTION public.is_relative_active_or_retained(target_resident_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.resident_relative_links rrl
        JOIN public.residents r ON r.id = rrl.resident_id
        WHERE rrl.resident_id = target_resident_id
        AND rrl.relative_user_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
        AND r.archived_at IS NULL
        AND (
            (r.death_date IS NULL AND r.contract_end_date IS NULL)
            OR (COALESCE(r.death_date, r.contract_end_date) + INTERVAL '30 days') >= CURRENT_DATE
        )
    );
END;
$$;

-- 2. Aktualizacja polityki SELECT na daily_reports dla bliskich
DROP POLICY IF EXISTS "Family can read published daily reports" ON public.daily_reports;

CREATE POLICY "Family can read published daily reports"
    ON public.daily_reports FOR SELECT TO authenticated
    USING (
        status = 'PUBLISHED'
        AND (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('family', 'legal_guardian')
        AND public.is_relative_active_or_retained(daily_reports.resident_id)
    );

-- 3. Aktualizacja polityki SELECT na resident_media dla bliskich
DROP POLICY IF EXISTS "Family can view linked resident media" ON public.resident_media;

CREATE POLICY "Family can view linked resident media"
    ON public.resident_media FOR SELECT
    USING (
        public.is_relative_active_or_retained(resident_media.resident_id)
    );

-- 4. Aktualizacja polityki SELECT na agenda_items dla bliskich
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
            OR (COALESCE(r.death_date, r.contract_end_date) + INTERVAL '30 days') >= CURRENT_DATE
          )
        )
      ) OR
      public.is_relative_active_or_retained(agenda_items.resident_id)
    )
  );

-- 5. Aktualizacja polityki SELECT i INSERT na family_messages dla bliskich
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
