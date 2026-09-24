-- Migration: 20260922110000_polar_oauth_tokens.sql
-- Description: Bezpieczne przechowywanie tokenów dostępowych Polar AccessLink per powiązanie urządzenia (R06-core-decoupled)

CREATE TABLE IF NOT EXISTS public.polar_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.external_wearable_links(id) ON DELETE CASCADE UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  token_type text DEFAULT 'bearer',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.polar_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- 1. Izolacja placówek (RESTRICTIVE)
CREATE POLICY "isolate_polar_oauth_tokens"
  ON public.polar_oauth_tokens
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (organization_id = public.get_jwt_organization_id());

-- 2. Dostęp do odczytu tokenów — tylko administratorzy placówki i super_admin (zakaz dla personelu i rodziny)
CREATE POLICY "allow_polar_tokens_read"
  ON public.polar_oauth_tokens
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('super_admin', 'org_admin')
  );

-- 3. Dostęp do zapisu tokenów — tylko administratorzy placówki i super_admin
CREATE POLICY "allow_polar_tokens_write"
  ON public.polar_oauth_tokens
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('super_admin', 'org_admin')
  );
