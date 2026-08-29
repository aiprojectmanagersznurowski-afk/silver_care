-- Migration: 20260829050000_consent_ledger.sql

CREATE TABLE IF NOT EXISTS public.consent_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    purpose text NOT NULL,
    granted_by text NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    CONSTRAINT valid_purpose CHECK (purpose IN ('wellness_data_ingest', 'medical_records_access', 'family_view_basic', 'family_view_full')),
    CONSTRAINT valid_grantor CHECK (granted_by IN ('resident_self', 'legal_guardian'))
);

ALTER TABLE public.consent_ledger ENABLE ROW LEVEL SECURITY;

-- 1. Read access
CREATE POLICY "consent_ledger_isolation" ON public.consent_ledger
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id()
  );

-- 2. Insert access (Only org_admin or via specific RPC if needed, but MVP keeps it simple)
CREATE POLICY "consent_ledger_insert" ON public.consent_ledger
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

-- NO UPDATE OR DELETE POLICIES = IMMUTABLE!

-- 3. Revoke RPC (must bypass RLS to update revoked_at)
CREATE OR REPLACE FUNCTION public.revoke_consent(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_res_id uuid;
  v_org_id uuid;
BEGIN
  -- Verify ownership and get resident_id
  SELECT resident_id, organization_id INTO v_res_id, v_org_id
  FROM public.consent_ledger
  WHERE id = p_id;

  IF NOT FOUND OR v_org_id != public.get_jwt_organization_id() THEN
    RAISE EXCEPTION 'Not authorized or consent not found';
  END IF;

  -- Bypass RLS to update
  UPDATE public.consent_ledger
  SET revoked_at = now()
  WHERE id = p_id;

  -- Audit log
  INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
  VALUES (v_org_id, v_res_id, 'CONSENT_WITHDRAWN', jsonb_build_object('consent_id', p_id));
END;
$$;
