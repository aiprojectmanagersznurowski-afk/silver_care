-- @REQ: NUR-SHIFT-PLAN-PRINT
-- @REQ: NUR-SHIFT-CLOSURE
CREATE FUNCTION private.shift_plan_has_unrostered_tasks(p_org uuid, p_shift uuid, p_date date)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shift_tasks t
    WHERE t.organization_id = p_org AND t.shift_definition_id = p_shift AND t.shift_date = p_date
      AND t.status = 'TODO' AND t.assignee_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.shift_tasks copy
        WHERE copy.organization_id = p_org AND copy.carried_from_task_id = t.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.shift_roster r JOIN auth.users u ON u.id = r.user_id
        WHERE r.organization_id = p_org AND r.shift_definition_id = p_shift AND r.shift_date = p_date
          AND r.user_id = t.assignee_user_id AND u.raw_app_meta_data->>'organization_id' = p_org::text
          AND u.raw_app_meta_data->>'role' IN ('nurse', 'org_admin')
          AND u.raw_app_meta_data->>'is_active' IS DISTINCT FROM 'false'
      )
  );
$$;

CREATE FUNCTION private.lock_shift_plan_roster_removal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (OLD.shift_definition_id, OLD.shift_date, OLD.user_id)
    IS DISTINCT FROM (NEW.shift_definition_id, NEW.shift_date, NEW.user_id) THEN
    PERFORM private.lock_shift_plan(OLD.shift_definition_id, OLD.shift_date);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER shift_plan_roster_removal_lock BEFORE DELETE OR UPDATE ON public.shift_roster
FOR EACH ROW EXECUTE FUNCTION private.lock_shift_plan_roster_removal();
REVOKE ALL ON FUNCTION private.shift_plan_has_unrostered_tasks(uuid,uuid,date), private.lock_shift_plan_roster_removal()
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.shift_plan_is_stale(p_approval public.shift_plan_approvals)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT private.shift_plan_has_unrostered_tasks(p_approval.organization_id,
    p_approval.shift_definition_id, p_approval.shift_date) OR CASE WHEN p_approval.task_fingerprint IS NOT NULL THEN
    p_approval.task_fingerprint IS DISTINCT FROM private.shift_plan_fingerprint(
      p_approval.organization_id, p_approval.shift_definition_id, p_approval.shift_date)
  ELSE EXISTS (
    SELECT 1 FROM public.shift_tasks t WHERE t.organization_id = p_approval.organization_id
      AND t.shift_definition_id = p_approval.shift_definition_id AND t.shift_date = p_approval.shift_date
      AND t.status <> 'PROPOSED' AND GREATEST(t.created_at, t.updated_at) > p_approval.approved_at
  ) END
$$;

CREATE OR REPLACE FUNCTION private.bind_shift_plan_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.lock_shift_plan(NEW.shift_definition_id, NEW.shift_date);
  IF private.shift_plan_has_unrostered_tasks(NEW.organization_id, NEW.shift_definition_id, NEW.shift_date) THEN
    RAISE EXCEPTION 'SHIFT_PLAN_ASSIGNEE_NOT_ON_ROSTER' USING ERRCODE = '23514';
  END IF;
  NEW.task_fingerprint := private.shift_plan_fingerprint(NEW.organization_id, NEW.shift_definition_id, NEW.shift_date);
  NEW.approved_at := clock_timestamp();
  NEW.printed_at := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_shift_task_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_role text := auth.jwt()->'app_metadata'->>'role';
  v_previous uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_previous := OLD.assignee_user_id;
  END IF;
  IF NEW.assignee_user_id IS NOT DISTINCT FROM v_previous THEN
    RETURN NEW;
  END IF;
  -- Kasowanie konta przez backend może wyzerować odwołanie przez klucz obcy.
  IF auth.uid() IS NULL AND NEW.assignee_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR NEW.organization_id IS DISTINCT FROM public.get_jwt_organization_id()
     OR (v_role = 'org_admin' OR (v_role = 'nurse' AND public.is_shift_lead(NEW.shift_definition_id, NEW.shift_date))) IS NOT TRUE THEN
    RAISE EXCEPTION 'SHIFT_ASSIGNMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NEW.status NOT IN ('PROPOSED', 'TODO') OR (TG_OP = 'UPDATE' AND OLD.status NOT IN ('PROPOSED', 'TODO')) THEN
    RAISE EXCEPTION 'SHIFT_ASSIGNMENT_TASK_SETTLED' USING ERRCODE = '23514';
  END IF;
  PERFORM private.lock_shift_plan(NEW.shift_definition_id, NEW.shift_date);
  IF NEW.assignee_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.shift_roster r JOIN auth.users u ON u.id = r.user_id
    WHERE r.organization_id = NEW.organization_id AND r.shift_definition_id = NEW.shift_definition_id
      AND r.shift_date = NEW.shift_date AND r.user_id = NEW.assignee_user_id
      AND u.raw_app_meta_data->>'organization_id' = NEW.organization_id::text
      AND u.raw_app_meta_data->>'role' IN ('nurse', 'org_admin')
      AND u.raw_app_meta_data->>'is_active' IS DISTINCT FROM 'false'
  ) THEN
    RAISE EXCEPTION 'SHIFT_ASSIGNEE_NOT_ON_ROSTER' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (NEW.organization_id, 'SHIFT_TASK_ASSIGNEE_CHANGED', auth.uid(), jsonb_build_object(
    'task_id', NEW.id, 'shift_definition_id', NEW.shift_definition_id, 'shift_date', NEW.shift_date,
    'previous_assignee_id', v_previous, 'assignee_id', NEW.assignee_user_id));
  RETURN NEW;
END;
$$;
