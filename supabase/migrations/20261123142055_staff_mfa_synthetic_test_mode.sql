-- @REQ: SEC-MFA-STAFF
-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: NUR-TASKS-VOICE-COMPLETION
-- Every deployed database starts strict. The local synthetic test operator may
-- replace only this private, owner-controlled function on its disposable stack.
CREATE FUNCTION private.staff_mfa_disabled_for_tests() RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
RETURN false;

REVOKE ALL ON FUNCTION private.staff_mfa_disabled_for_tests() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.staff_mfa_disabled_for_tests() TO authenticated, service_role;

CREATE FUNCTION public.staff_mfa_satisfied() RETURNS boolean
LANGUAGE sql STABLE SET search_path = ''
RETURN COALESCE(auth.jwt()->>'aal' = 'aal2', false) OR (
  auth.uid() IS NOT NULL
  AND COALESCE(auth.jwt()->'app_metadata'->>'role' IN ('super_admin', 'org_admin', 'nurse'), false)
  AND private.staff_mfa_disabled_for_tests()
);

REVOKE ALL ON FUNCTION public.staff_mfa_satisfied() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_mfa_satisfied() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_mfa_requirement() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF auth.jwt()->'app_metadata'->>'role' IN ('super_admin', 'org_admin', 'nurse')
    AND NOT public.staff_mfa_satisfied() THEN
    RAISE EXCEPTION 'MFA (aal2) required for staff roles' USING ERRCODE = '42501';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_staff_mfa() RETURNS void
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
BEGIN
  IF COALESCE(current_setting('request.path', true), '') NOT IN (
    '/rpc/get_org_feature_flags', '/rpc/staff_mfa_satisfied'
  ) THEN
    PERFORM public.check_mfa_requirement();
  END IF;
END;
$$;

-- Keep the existing role, organization, source, retention and module checks.
ALTER POLICY voice_reports_mfa ON public.organization_report_configs USING ((SELECT public.staff_mfa_satisfied()));
ALTER POLICY voice_reports_mfa ON public.voice_sanitized_events USING ((SELECT public.staff_mfa_satisfied()));
ALTER POLICY voice_reports_mfa ON public.operational_reports USING ((SELECT public.staff_mfa_satisfied()));

ALTER POLICY voice_segment_proposals_staff ON public.voice_segment_proposals USING (
  organization_id = (SELECT public.get_jwt_organization_id())
  AND public.has_org_feature(organization_id, 'module_voice_and_reports')
  AND (SELECT public.staff_mfa_satisfied())
  AND ((SELECT auth.jwt())->'app_metadata'->>'role' = 'org_admin'
    OR ((SELECT auth.jwt())->'app_metadata'->>'role' = 'nurse' AND author_id = (SELECT auth.uid())))
);

ALTER POLICY voice_retention_staff ON public.voice_retention_settings USING (
  (SELECT public.staff_mfa_satisfied())
  AND ((SELECT auth.jwt())->'app_metadata'->>'role' = 'super_admin'
    OR ((SELECT auth.jwt())->'app_metadata'->>'role' = 'org_admin'
      AND organization_id = (SELECT public.get_jwt_organization_id())))
);

ALTER POLICY voice_assignment_queue_open_staff ON public.voice_assignment_queue USING (
  decided_at IS NULL
  AND organization_id = (SELECT public.get_jwt_organization_id())
  AND public.has_org_feature(organization_id, 'module_voice_and_reports')
  AND (SELECT public.staff_mfa_satisfied())
  AND CASE (SELECT auth.jwt())->'app_metadata'->>'role'
    WHEN 'org_admin' THEN true
    WHEN 'nurse' THEN public.is_shift_lead(shift_definition_id, shift_date)
    ELSE false END
  AND private.voice_source_within_retention(segment_id, organization_id)
);

CREATE OR REPLACE FUNCTION private.require_report_staff(p_org uuid, p_roles text[], p_write boolean) RETURNS void
LANGUAGE plpgsql SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_user uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_role text := v_claims->'app_metadata'->>'role';
BEGIN
  IF v_user IS NULL OR NOT COALESCE(v_role = ANY(p_roles), false)
    OR (v_role <> 'super_admin' AND p_org IS DISTINCT FROM public.get_jwt_organization_id()) THEN
    RAISE EXCEPTION 'REPORT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF NOT public.staff_mfa_satisfied() THEN
    RAISE EXCEPTION 'MFA_AAL2_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_org_feature(p_org, 'module_voice_and_reports') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  IF p_write THEN
    PERFORM private.impersonation_actor_lock(v_user);
    IF NULLIF(v_claims->>'impersonator_id', '') IS NOT NULL
      OR NULLIF(v_claims->'app_metadata'->>'impersonator_id', '') IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.active_impersonation_sessions s
        WHERE (s.actor_id = v_user OR s.target_admin_id = v_user) AND s.expires_at > pg_catalog.now()) THEN
      RAISE EXCEPTION 'IMPERSONATION_WRITE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.can_play_voice_segment(p_segment_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND public.staff_mfa_satisfied()
    AND EXISTS (
      SELECT 1 FROM public.voice_assignment_queue q
      JOIN public.voice_segments s ON s.id = q.segment_id AND s.organization_id = q.organization_id
      JOIN public.voice_captures c ON c.id = s.capture_id AND c.organization_id = q.organization_id
      LEFT JOIN public.voice_retention_settings r ON r.organization_id = q.organization_id
      WHERE q.segment_id = p_segment_id AND q.organization_id = public.get_jwt_organization_id()
        AND q.decided_at IS NULL AND s.assignment_status = 'PENDING' AND c.status = 'SEGMENTED'
        AND c.source IN ('APP_GENERAL', 'DEVICE')
        AND c.received_at >= now() - make_interval(days => COALESCE(r.retention_days, 30))
        AND public.has_org_feature(q.organization_id, 'module_voice_and_reports')
        AND CASE auth.jwt()->'app_metadata'->>'role'
          WHEN 'org_admin' THEN true
          WHEN 'nurse' THEN public.is_shift_lead(q.shift_definition_id, q.shift_date)
          ELSE false END
        AND EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'voice-recordings' AND name = c.storage_path)
        AND NOT EXISTS (SELECT 1 FROM public.voice_storage_deletions WHERE path = c.storage_path)
    );
$$;

CREATE OR REPLACE FUNCTION private.can_read_shift_task_voice_suggestion(p_evidence public.shift_task_voice_suggestions)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text := auth.jwt()->'app_metadata'->>'role';
BEGIN
  IF auth.uid() IS NULL OR NOT public.staff_mfa_satisfied()
    OR p_evidence.organization_id IS DISTINCT FROM public.get_jwt_organization_id()
    OR (v_role = 'org_admin' OR (v_role = 'nurse'
        AND public.is_shift_lead(p_evidence.shift_definition_id, p_evidence.shift_date))) IS NOT TRUE
    OR NOT public.has_org_feature(p_evidence.organization_id, 'module_voice_and_reports')
    OR NOT public.has_org_feature(p_evidence.organization_id, 'module_shift_tasks') THEN
    RETURN false;
  END IF;
  RETURN private.shift_task_voice_source_current(p_evidence);
END $$;

CREATE OR REPLACE FUNCTION public.set_organization_feature_flag(p_org_id uuid, p_feature_key text, p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_previous boolean;
  v_changed text[];
BEGIN
  IF v_actor IS NULL OR v_claims->'app_metadata'->>'role' IS DISTINCT FROM 'super_admin'
     OR NOT public.staff_mfa_satisfied() THEN
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

CREATE OR REPLACE FUNCTION public.hard_delete_resident(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET log_parameter_max_length_on_error = 0
AS $$
DECLARE
  v_claims jsonb := COALESCE(NULLIF(pg_catalog.current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_actor uuid := auth.uid();
BEGIN
  IF NULLIF(v_claims->>'impersonator_id', '') IS NOT NULL
     OR NULLIF(v_claims->'app_metadata'->>'impersonator_id', '') IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot perform destructive actions during impersonation' USING ERRCODE = '42501';
  END IF;

  IF v_actor IS NOT NULL THEN
    PERFORM private.impersonation_actor_lock(v_actor);
    DELETE FROM public.active_impersonation_sessions
    WHERE (actor_id = v_actor OR target_admin_id = v_actor)
      AND expires_at <= pg_catalog.now();

    IF EXISTS (
      SELECT 1
      FROM public.active_impersonation_sessions s
      WHERE (s.actor_id = v_actor OR s.target_admin_id = v_actor)
        AND s.expires_at > pg_catalog.now()
    ) THEN
      RAISE EXCEPTION 'Cannot perform destructive actions during impersonation' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_actor IS NULL
     OR (v_claims->'app_metadata'->>'role') IS DISTINCT FROM 'org_admin'
     OR NOT public.staff_mfa_satisfied() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.residents r
    WHERE r.id = p_id
      AND r.organization_id = public.get_jwt_organization_id()
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('audit.allow_redact', 'true', true);

  UPDATE public.audit_logs
  SET payload = pg_catalog.jsonb_build_object('redacted', true)
  WHERE resident_id = p_id;

  PERFORM pg_catalog.set_config('audit.allow_redact', 'false', true);

  DELETE FROM public.residents
  WHERE id = p_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
