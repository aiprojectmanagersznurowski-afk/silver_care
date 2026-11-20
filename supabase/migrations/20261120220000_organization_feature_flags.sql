-- @REQ: SUP-FEATURE-FLAGS
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE public.feature_flag_defaults (
  feature_key text PRIMARY KEY,
  default_enabled boolean NOT NULL,
  depends_on text[] NOT NULL
);
ALTER TABLE public.feature_flag_defaults ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feature_flag_defaults FROM PUBLIC, anon, authenticated, service_role;

-- Source: contracts/features.contract.mjs. tests/db/feature_flags.test.ts checks parity.
INSERT INTO public.feature_flag_defaults (feature_key, default_enabled, depends_on) VALUES
  ('module_facility_management', true, ARRAY[]::text[]),
  ('module_residents_management', true, ARRAY[]::text[]),
  ('module_voice_and_reports', true, ARRAY[]::text[]),
  ('module_shift_tasks', true, ARRAY[]::text[]),
  ('module_audit_compliance', false, ARRAY[]::text[]),
  ('module_family_portal', true, ARRAY['module_residents_management']::text[]),
  ('module_documents_contracts', true, ARRAY['module_residents_management']::text[]),
  ('module_finance_budget', false, ARRAY['module_facility_management']::text[]),
  ('module_wearables_iot', true, ARRAY['module_residents_management']::text[]),
  ('allow_org_admin_report_config', false, ARRAY['module_voice_and_reports']::text[]),
  ('allow_org_admin_contract_templates', false, ARRAY['module_documents_contracts']::text[]);

CREATE TABLE public.organization_feature_flags (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.feature_flag_defaults(feature_key),
  enabled boolean NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, feature_key)
);
ALTER TABLE public.organization_feature_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_feature_flags FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.organization_feature_flags TO authenticated, service_role;
CREATE POLICY feature_flags_select ON public.organization_feature_flags FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    OR (
      organization_id = (SELECT public.get_jwt_organization_id())
      AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse', 'legal_guardian', 'family')
    )
  );
CREATE POLICY feature_flags_mfa ON public.organization_feature_flags AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.check_mfa_requirement()));

CREATE TABLE public.active_impersonation_sessions (
  actor_id uuid NOT NULL,
  session_id uuid NOT NULL,
  target_admin_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (actor_id, session_id)
);
ALTER TABLE public.active_impersonation_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.active_impersonation_sessions FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.impersonation_actor_lock(p_actor uuid) RETURNS void
LANGUAGE sql SET search_path = ''
AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(1, pg_catalog.hashtext(p_actor::text))
$$;
REVOKE ALL ON FUNCTION private.impersonation_actor_lock(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.log_impersonation_start(p_target_admin_id uuid, p_target_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_session uuid := COALESCE((auth.jwt()->>'session_id')::uuid, v_actor);
BEGIN
  IF auth.jwt()->'app_metadata'->>'role' IS DISTINCT FROM 'super_admin' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only super_admin can log impersonation' USING ERRCODE = '42501';
  END IF;

  PERFORM private.impersonation_actor_lock(v_actor);
  DELETE FROM public.active_impersonation_sessions WHERE actor_id = v_actor AND expires_at <= now();
  INSERT INTO public.active_impersonation_sessions (actor_id, session_id, target_admin_id, organization_id, expires_at)
  VALUES (v_actor, v_session, p_target_admin_id, p_target_org_id, now() + interval '1 hour')
  ON CONFLICT (actor_id, session_id) DO UPDATE SET target_admin_id = EXCLUDED.target_admin_id,
    organization_id = EXCLUDED.organization_id, expires_at = EXCLUDED.expires_at;

  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (p_target_org_id, 'IMPERSONATE_START', v_actor, jsonb_build_object('target_admin_id', p_target_admin_id));
END
$$;
REVOKE ALL ON FUNCTION public.log_impersonation_start(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.log_impersonation_start(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_impersonation_stop(p_target_admin_id uuid, p_target_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_session uuid := COALESCE((auth.jwt()->>'session_id')::uuid, v_actor);
BEGIN
  IF auth.jwt()->'app_metadata'->>'role' IS DISTINCT FROM 'super_admin' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only super_admin can log impersonation' USING ERRCODE = '42501';
  END IF;

  PERFORM private.impersonation_actor_lock(v_actor);
  DELETE FROM public.active_impersonation_sessions
  WHERE actor_id = v_actor AND session_id = v_session
    AND target_admin_id = p_target_admin_id AND organization_id = p_target_org_id;
  IF FOUND THEN
    INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
    VALUES (p_target_org_id, 'IMPERSONATE_STOP', v_actor, jsonb_build_object('target_admin_id', p_target_admin_id));
  END IF;
END
$$;
REVOKE ALL ON FUNCTION public.log_impersonation_stop(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.log_impersonation_stop(uuid, uuid) TO authenticated;

CREATE FUNCTION private.feature_enabled(p_org_id uuid, p_feature_key text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
AS $$
  WITH RECURSIVE required_features AS (
    SELECT f.* FROM public.feature_flag_defaults f WHERE f.feature_key = p_feature_key
    UNION
    SELECT f.* FROM required_features r JOIN public.feature_flag_defaults f ON f.feature_key = ANY(r.depends_on)
  )
  SELECT COALESCE(bool_and(COALESCE(o.enabled, f.default_enabled)), false)
  FROM required_features f
  LEFT JOIN public.organization_feature_flags o ON o.organization_id = p_org_id AND o.feature_key = f.feature_key
$$;
REVOKE ALL ON FUNCTION private.feature_enabled(uuid, text) FROM PUBLIC;

CREATE FUNCTION public.has_org_feature(p_org_id uuid, p_feature_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE WHEN p_org_id IS NOT NULL AND (
    current_setting('role') IN ('service_role', 'postgres')
    OR (current_setting('role') = 'none' AND session_user = 'postgres')
    OR (auth.uid() IS NOT NULL AND (
      auth.jwt()->'app_metadata'->>'role' = 'super_admin'
      OR p_org_id = public.get_jwt_organization_id()
    ))
  ) AND EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id)
  THEN private.feature_enabled(p_org_id, p_feature_key)
  ELSE false END
$$;

CREATE FUNCTION public.has_resident_org_feature(p_resident_id uuid, p_feature_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT public.has_org_feature(r.organization_id, p_feature_key)
    FROM public.residents r WHERE r.id = p_resident_id
      AND (COALESCE(auth.jwt()->'app_metadata'->>'role', '') NOT IN ('family', 'legal_guardian')
           OR public.is_relative_linked(r.id))
  ), false)
$$;

REVOKE ALL ON FUNCTION public.has_org_feature(uuid, text), public.has_resident_org_feature(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_org_feature(uuid, text), public.has_resident_org_feature(uuid, text)
  TO authenticated, service_role;

CREATE FUNCTION public.set_organization_feature_flag(p_org_id uuid, p_feature_key text, p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_previous boolean;
  v_changed text[];
BEGIN
  IF v_actor IS NULL OR v_claims->'app_metadata'->>'role' IS DISTINCT FROM 'super_admin'
     OR v_claims->>'aal' IS DISTINCT FROM 'aal2' OR NOT public.check_mfa_requirement() THEN
    RAISE EXCEPTION 'FEATURE_FLAG_AUTHORIZATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM private.impersonation_actor_lock(v_actor);
  IF v_claims->>'impersonator_id' IS NOT NULL OR v_claims->'app_metadata'->>'impersonator_id' IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.active_impersonation_sessions WHERE actor_id = v_actor AND expires_at > now()) THEN
    RAISE EXCEPTION 'FEATURE_FLAG_IMPERSONATION_BLOCKED' USING ERRCODE = '42501';
  END IF;
  IF p_enabled IS NULL OR NOT EXISTS (SELECT 1 FROM public.feature_flag_defaults WHERE feature_key = p_feature_key) THEN
    RAISE EXCEPTION 'FEATURE_FLAG_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id FOR KEY SHARE) THEN
    RAISE EXCEPTION 'FEATURE_FLAG_ORGANIZATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(2, hashtext(p_org_id::text));
  IF p_enabled AND EXISTS (
    SELECT 1 FROM public.feature_flag_defaults f CROSS JOIN LATERAL unnest(f.depends_on) AS parent(key)
    WHERE f.feature_key = p_feature_key AND NOT private.feature_enabled(p_org_id, parent.key)
  ) THEN
    RAISE EXCEPTION 'FEATURE_DEPENDENCY_DISABLED' USING ERRCODE = '23514';
  END IF;

  v_previous := private.feature_enabled(p_org_id, p_feature_key);
  IF v_previous = p_enabled THEN
    RETURN jsonb_build_object('changed', '[]'::jsonb);
  END IF;

  WITH RECURSIVE descendants(feature_key) AS (
    SELECT p_feature_key
    UNION
    SELECT f.feature_key FROM descendants d
      JOIN public.feature_flag_defaults f ON d.feature_key = ANY(f.depends_on)
    WHERE NOT p_enabled
  )
  SELECT array_agg(d.feature_key ORDER BY d.feature_key) INTO v_changed
  FROM descendants d
  WHERE d.feature_key = p_feature_key OR private.feature_enabled(p_org_id, d.feature_key);

  INSERT INTO public.organization_feature_flags (organization_id, feature_key, enabled, updated_by)
  SELECT p_org_id, key, p_enabled, v_actor FROM unnest(v_changed) AS changed(key)
  ON CONFLICT (organization_id, feature_key) DO UPDATE
    SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = now();

  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  SELECT p_org_id, 'ORG_FEATURE_FLAG_UPDATED', v_actor, jsonb_build_object(
    'feature_key', key, 'previous_value', NOT p_enabled, 'new_value', p_enabled,
    'cascade_from', CASE WHEN key <> p_feature_key THEN p_feature_key END
  ) FROM unnest(v_changed) AS changed(key);

  RETURN jsonb_build_object('changed', v_changed);
END
$$;
REVOKE ALL ON FUNCTION public.set_organization_feature_flag(uuid, text, boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_organization_feature_flag(uuid, text, boolean) TO authenticated;
