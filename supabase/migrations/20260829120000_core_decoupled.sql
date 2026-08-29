-- 1. INT-CORE-DECOUPLED: create external_wearable_links
CREATE TABLE public.external_wearable_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_user_id text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(provider, external_user_id),
  UNIQUE(resident_id, provider)
);

ALTER TABLE public.external_wearable_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isolate_external_wearable_links"
  ON public.external_wearable_links
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (organization_id = public.get_jwt_organization_id());

CREATE POLICY "allow_external_wearable_links_read"
  ON public.external_wearable_links
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('super_admin', 'org_admin', 'nurse')
  );

CREATE POLICY "allow_external_wearable_links_write"
  ON public.external_wearable_links
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('super_admin', 'org_admin')
  );

-- 2. SEC-RETENTION: function to enforce retention
CREATE OR REPLACE FUNCTION public.enforce_retention_policy(years_to_keep int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We allow deleting logs for retention purposes
  PERFORM set_config('audit.allow_redact', 'true', true);

  DELETE FROM public.audit_logs
  WHERE created_at < now() - (years_to_keep || ' years')::interval;
END;
$$;

-- 3. SEC-403-LOGGING: log access denied
CREATE OR REPLACE FUNCTION public.log_access_denied(p_org_id uuid, p_resident_id uuid, p_action text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allowed to log ACCESS_DENIED with this function
  INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
  VALUES (p_org_id, p_resident_id, 'ACCESS_DENIED', p_payload);
END;
$$;
