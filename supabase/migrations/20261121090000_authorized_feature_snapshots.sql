-- @REQ: SUP-FEATURE-FLAGS
CREATE FUNCTION private.can_read_org_features(p_org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT p_org_id IS NOT NULL AND (
    current_setting('role') IN ('service_role', 'postgres')
    OR (current_setting('role') = 'none' AND session_user = 'postgres')
    OR (auth.uid() IS NOT NULL AND (
      auth.jwt()->'app_metadata'->>'role' = 'super_admin'
      OR (
        auth.jwt()->'app_metadata'->>'role' IN ('org_admin', 'nurse', 'legal_guardian', 'family')
        AND p_org_id = public.get_jwt_organization_id()
      )
    ))
  ) AND EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id)
$$;
REVOKE ALL ON FUNCTION private.can_read_org_features(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.has_org_feature(p_org_id uuid, p_feature_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE WHEN private.can_read_org_features(p_org_id)
    THEN private.feature_enabled(p_org_id, p_feature_key)
    ELSE false END
$$;

-- Technical configuration is readable before MFA enrollment. Mutations still require aal2.
CREATE FUNCTION public.get_org_feature_flags(p_org_id uuid)
RETURNS TABLE(feature_key text, enabled boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF private.can_read_org_features(p_org_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Organization feature flags unavailable' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT f.feature_key, private.feature_enabled(p_org_id, f.feature_key)
  FROM public.feature_flag_defaults f;
END
$$;
REVOKE ALL ON FUNCTION public.get_org_feature_flags(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_feature_flags(uuid) TO authenticated, service_role;
