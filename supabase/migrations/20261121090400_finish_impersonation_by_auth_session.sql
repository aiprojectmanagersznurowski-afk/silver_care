-- @REQ: SUP-FEATURE-FLAGS

CREATE OR REPLACE FUNCTION public.log_impersonation_start(p_target_admin_id uuid, p_target_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_session uuid := COALESCE(NULLIF(auth.jwt()->>'session_id', '')::uuid, v_actor);
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

CREATE OR REPLACE FUNCTION public.log_impersonation_stop(p_target_admin_id uuid, p_target_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_session uuid := COALESCE(NULLIF(auth.jwt()->>'session_id', '')::uuid, v_actor);
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

-- Close the preview associated with the caller's Auth session, including sign-out without a preview cookie.
CREATE FUNCTION public.finish_impersonation() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_session uuid := COALESCE(NULLIF(auth.jwt()->>'session_id', '')::uuid, v_actor);
  v_closed public.active_impersonation_sessions%ROWTYPE;
BEGIN
  IF auth.jwt()->'app_metadata'->>'role' IS DISTINCT FROM 'super_admin' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only super_admin can finish impersonation' USING ERRCODE = '42501';
  END IF;

  PERFORM private.impersonation_actor_lock(v_actor);
  DELETE FROM public.active_impersonation_sessions
  WHERE actor_id = v_actor AND session_id = v_session
  RETURNING * INTO v_closed;
  IF FOUND THEN
    INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
    VALUES (v_closed.organization_id, 'IMPERSONATE_STOP', v_actor,
            jsonb_build_object('target_admin_id', v_closed.target_admin_id));
  END IF;

  RETURN v_closed.organization_id;
END
$$;
REVOKE ALL ON FUNCTION public.finish_impersonation() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.finish_impersonation() TO authenticated;
