-- @REQ: ADM-ARCHIVE @REQ: SEC-AUDIT-APPEND-ONLY @REQ: SEC-MFA-STAFF @REQ: ORG-ISOLATION
-- Harden public.hard_delete_resident authorization, MFA (aal2), impersonation lock,
-- full payload scrubbing, and immediate reset of audit.allow_redact.

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
     OR (v_claims->>'aal') IS DISTINCT FROM 'aal2'
     OR NOT (SELECT public.check_mfa_requirement()) THEN
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

REVOKE ALL ON FUNCTION public.hard_delete_resident(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.hard_delete_resident(uuid) TO authenticated;
