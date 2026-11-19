-- Migration: 20261116190000_resident_funding.sql
-- @REQ: ADM-RESIDENT-FUNDING, @REQ: ORG-ISOLATION
--
-- Źródło finansowania pobytu podopiecznego (SC-ADM-24, decyzja Michała 2026-11-16),
-- oddzielnie od residents.contract_source (kanał pozyskania).
--
-- Osobna tabela zamiast kolumny w residents: rodzina i pielęgniarka mają dziś odczyt wiersza residents,
-- a źródło finansowania czyta i zmienia wyłącznie kierownik placówki.
-- Brak wiersza = „Brak danych”. Migracja nie tworzy wierszy dla istniejących podopiecznych.

CREATE TABLE IF NOT EXISTS public.resident_funding (
  resident_id uuid PRIMARY KEY REFERENCES public.residents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  funding_source text NOT NULL
    CONSTRAINT resident_funding_source_check CHECK (funding_source IN ('private', 'municipality', 'co_financed', 'other')),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resident_funding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resident_funding_org_admin_select" ON public.resident_funding;
CREATE POLICY "resident_funding_org_admin_select" ON public.resident_funding
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_jwt_organization_id()
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'org_admin'
  );

DROP POLICY IF EXISTS "resident_funding_org_admin_insert" ON public.resident_funding;
CREATE POLICY "resident_funding_org_admin_insert" ON public.resident_funding
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_jwt_organization_id()
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'org_admin'
    AND EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = resident_funding.resident_id
        AND r.organization_id = public.get_jwt_organization_id()
    )
  );

DROP POLICY IF EXISTS "resident_funding_org_admin_update" ON public.resident_funding;
CREATE POLICY "resident_funding_org_admin_update" ON public.resident_funding
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_jwt_organization_id()
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'org_admin'
  )
  WITH CHECK (
    organization_id = public.get_jwt_organization_id()
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'org_admin'
    AND EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = resident_funding.resident_id
        AND r.organization_id = public.get_jwt_organization_id()
    )
  );

-- Brak polityki DELETE: story SC-ADM-24 nie przewiduje usunięcia wartości; RLS odrzuca każde usunięcie.

REVOKE ALL ON TABLE public.resident_funding FROM PUBLIC;
REVOKE ALL ON TABLE public.resident_funding FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resident_funding TO authenticated;
GRANT ALL ON TABLE public.resident_funding TO service_role;
