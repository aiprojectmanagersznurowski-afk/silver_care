-- @REQ: SEC-MFA-STAFF
CREATE OR REPLACE FUNCTION public.check_mfa_requirement()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  claims jsonb := auth.jwt();
BEGIN
  -- MFA_REQUIRED_ROLES from contracts/roles.contract.mjs.
  IF claims->'app_metadata'->>'role' IN ('super_admin', 'org_admin', 'nurse')
     AND claims->>'aal' IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'MFA (aal2) required for staff roles' USING ERRCODE = '42501';
  END IF;
  RETURN true;
END;
$$;

-- Protect direct reads and writes, including paths other than PostgREST.
DO $$
DECLARE
  resource text;
BEGIN
  FOREACH resource IN ARRAY ARRAY[
    'agenda_items', 'bed_assignments', 'beds', 'consent_ledger', 'external_wearable_links',
    'family_messages', 'organizations', 'physiological_data_ingest', 'report_feedback',
    'resident_care_level_history', 'resident_death_reports', 'resident_events',
    'resident_funding', 'resident_invitations', 'resident_media', 'resident_packages',
    'resident_relative_links', 'residents', 'rooms'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY require_staff_mfa ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.check_mfa_requirement()))',
      resource
    );
  END LOOP;
END;
$$;

CREATE POLICY require_staff_mfa ON public.audit_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING ((SELECT public.check_mfa_requirement()));

CREATE POLICY require_staff_mfa ON public.security_access_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING ((SELECT public.check_mfa_requirement()));

CREATE POLICY require_staff_mfa ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.check_mfa_requirement()));

-- Security definer RPCs run with their owner's permissions, so check the request first.
CREATE OR REPLACE FUNCTION public.enforce_staff_mfa()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  -- The effective flags RPC contains no resident data and enforces its own role and tenant scope.
  IF current_setting('request.path', true) IS DISTINCT FROM '/rpc/get_org_feature_flags' THEN
    PERFORM public.check_mfa_requirement();
  END IF;
END;
$$;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.enforce_staff_mfa';
NOTIFY pgrst, 'reload config';
