-- @REQ: NUR-SHIFT-PLAN-PRINT
-- @REQ: NUR-SHIFT-CLOSURE
-- @REQ: SEC-MFA-STAFF
ALTER TABLE public.shift_plan_approvals ADD COLUMN task_fingerprint text;

CREATE FUNCTION private.lock_shift_plan(p_shift uuid, p_date date) RETURNS void
LANGUAGE sql SET search_path = '' AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('shift-plan:' || p_shift || ':' || p_date, 0))
$$;

CREATE FUNCTION private.shift_plan_fingerprint(p_org uuid, p_shift uuid, p_date date)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT private.shift_handover_revision(COALESCE(jsonb_agg(
    jsonb_build_array(t.id, t.status, t.resident_id, t.assignee_user_id, t.title, t.due_time, t.source, t.carried_from_task_id, t.updated_at,
      EXISTS (SELECT 1 FROM public.shift_tasks n
        WHERE n.organization_id = p_org AND n.carried_from_task_id = t.id))
    ORDER BY t.id), '[]'::jsonb))
  FROM public.shift_tasks t WHERE t.organization_id = p_org AND t.shift_definition_id = p_shift
    AND t.shift_date = p_date AND t.status <> 'PROPOSED'
$$;

CREATE FUNCTION private.shift_plan_is_stale(p_approval public.shift_plan_approvals)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_approval.task_fingerprint IS NOT NULL THEN
    p_approval.task_fingerprint IS DISTINCT FROM private.shift_plan_fingerprint(
      p_approval.organization_id, p_approval.shift_definition_id, p_approval.shift_date)
  ELSE EXISTS (
    SELECT 1 FROM public.shift_tasks t WHERE t.organization_id = p_approval.organization_id
      AND t.shift_definition_id = p_approval.shift_definition_id AND t.shift_date = p_approval.shift_date
      AND t.status <> 'PROPOSED' AND GREATEST(t.created_at, t.updated_at) > p_approval.approved_at
  ) END
$$;

CREATE FUNCTION private.bind_shift_plan_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.lock_shift_plan(NEW.shift_definition_id, NEW.shift_date);
  NEW.task_fingerprint := private.shift_plan_fingerprint(NEW.organization_id, NEW.shift_definition_id, NEW.shift_date);
  NEW.approved_at := clock_timestamp();
  NEW.printed_at := NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER shift_plan_approval_bind_content BEFORE INSERT ON public.shift_plan_approvals
FOR EACH ROW EXECUTE FUNCTION private.bind_shift_plan_content();

CREATE FUNCTION private.lock_shift_plan_task() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.lock_shift_plan(NEW.shift_definition_id, NEW.shift_date);
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER shift_tasks_plan_lock BEFORE INSERT OR UPDATE ON public.shift_tasks
FOR EACH ROW EXECUTE FUNCTION private.lock_shift_plan_task();

CREATE FUNCTION public.get_shift_plan_status(p_shift uuid, p_date date)
RETURNS TABLE (version integer, stale boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.version, private.shift_plan_is_stale(a)
  FROM public.shift_plan_approvals a
  WHERE a.organization_id = public.get_jwt_organization_id() AND a.shift_definition_id = p_shift AND a.shift_date = p_date
    AND private.can_read_shift_tasks(a.organization_id, p_shift, p_date)
    AND public.staff_mfa_satisfied() AND public.has_org_feature(a.organization_id, 'module_shift_tasks')
  ORDER BY a.version DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.record_shift_plan_print(p_shift_definition_id uuid, p_shift_date date, p_expected_version integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_org uuid := public.get_jwt_organization_id();
  v_role text := auth.jwt()->'app_metadata'->>'role';
  v_approval public.shift_plan_approvals;
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.staff_mfa_satisfied()
    OR auth.jwt()->'app_metadata'->>'impersonator_id' IS NOT NULL
    OR NOT public.has_org_feature(v_org, 'module_shift_tasks')
    OR (v_role = 'org_admin' OR (v_role = 'nurse' AND public.is_shift_lead(p_shift_definition_id, p_shift_date))) IS NOT TRUE THEN
    RAISE EXCEPTION 'SHIFT_NOT_LEAD' USING ERRCODE = '42501';
  END IF;

  PERFORM private.lock_shift_plan(p_shift_definition_id, p_shift_date);
  SELECT * INTO v_approval FROM public.shift_plan_approvals a
  WHERE a.organization_id = v_org AND a.shift_definition_id = p_shift_definition_id AND a.shift_date = p_shift_date
  ORDER BY a.version DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIFT_PLAN_NOT_APPROVED' USING ERRCODE = '23514';
  END IF;
  IF p_expected_version IS DISTINCT FROM v_approval.version THEN
    RAISE EXCEPTION 'SHIFT_PLAN_VERSION_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF private.shift_plan_is_stale(v_approval) THEN
    RAISE EXCEPTION 'SHIFT_PLAN_STALE' USING ERRCODE = '23514';
  END IF;

  UPDATE public.shift_plan_approvals SET printed_at = clock_timestamp() WHERE id = v_approval.id;
  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (v_org, 'SHIFT_PLAN_PRINTED', auth.uid(), jsonb_build_object(
    'shift_definition_id', p_shift_definition_id, 'shift_date', p_shift_date, 'version', v_approval.version));
  RETURN v_approval.version;
END;
$$;

REVOKE ALL ON FUNCTION private.lock_shift_plan(uuid,date), private.shift_plan_fingerprint(uuid,uuid,date),
  private.shift_plan_is_stale(public.shift_plan_approvals), private.bind_shift_plan_content(), private.lock_shift_plan_task()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_shift_plan_status(uuid,date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_shift_plan_status(uuid,date) TO authenticated;
