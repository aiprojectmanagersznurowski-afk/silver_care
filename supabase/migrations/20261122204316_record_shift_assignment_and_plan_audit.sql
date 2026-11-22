-- NUR-SHIFT-CLOSURE: przypisanie z grafiku i transakcyjny audyt zmian planu.
-- Wycofanie: usuń trzy triggery oraz ich funkcje. Zapisany audyt pozostaje historią.

CREATE FUNCTION private.guard_shift_task_assignment() RETURNS trigger
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
REVOKE ALL ON FUNCTION private.guard_shift_task_assignment() FROM PUBLIC;
CREATE TRIGGER shift_task_assignment_guard BEFORE INSERT OR UPDATE OF assignee_user_id ON public.shift_tasks
  FOR EACH ROW EXECUTE FUNCTION private.guard_shift_task_assignment();

CREATE FUNCTION private.audit_shift_task_carry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_role text := auth.jwt()->'app_metadata'->>'role';
  v_source public.shift_tasks%ROWTYPE;
BEGIN
  SELECT * INTO v_source FROM public.shift_tasks
  WHERE id = NEW.carried_from_task_id AND organization_id = NEW.organization_id;
  IF NOT FOUND OR auth.uid() IS NULL OR NEW.organization_id IS DISTINCT FROM public.get_jwt_organization_id()
     OR (v_role = 'org_admin' OR (v_role = 'nurse' AND public.is_shift_lead(v_source.shift_definition_id, v_source.shift_date))) IS NOT TRUE THEN
    RAISE EXCEPTION 'SHIFT_CARRY_SOURCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF v_source.status <> 'TODO' OR NEW.status <> 'TODO'
     OR (v_source.shift_definition_id = NEW.shift_definition_id AND v_source.shift_date = NEW.shift_date) THEN
    RAISE EXCEPTION 'SHIFT_CARRY_SOURCE_INVALID' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (NEW.organization_id, 'SHIFT_TASK_CARRIED', auth.uid(), jsonb_build_object(
    'task_id', NEW.id, 'source_task_id', v_source.id,
    'source_shift_definition_id', v_source.shift_definition_id, 'source_shift_date', v_source.shift_date,
    'shift_definition_id', NEW.shift_definition_id, 'shift_date', NEW.shift_date));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_shift_task_carry() FROM PUBLIC;
CREATE TRIGGER shift_task_carry_audit AFTER INSERT ON public.shift_tasks
  FOR EACH ROW WHEN (NEW.carried_from_task_id IS NOT NULL) EXECUTE FUNCTION private.audit_shift_task_carry();

CREATE FUNCTION private.audit_shift_plan_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (NEW.organization_id, 'SHIFT_PLAN_APPROVED', NEW.approved_by, jsonb_build_object(
    'shift_definition_id', NEW.shift_definition_id, 'shift_date', NEW.shift_date, 'version', NEW.version));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_shift_plan_approval() FROM PUBLIC;
CREATE TRIGGER shift_plan_approval_audit AFTER INSERT ON public.shift_plan_approvals
  FOR EACH ROW EXECUTE FUNCTION private.audit_shift_plan_approval();
