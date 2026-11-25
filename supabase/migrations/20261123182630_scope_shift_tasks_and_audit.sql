-- @REQ: NUR-TASKS
-- @REQ: NUR-SHIFT-CLOSURE
-- @REQ: SEC-MFA-STAFF
CREATE FUNCTION private.can_read_shift_tasks(p_org uuid, p_shift uuid, p_date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND p_org = public.get_jwt_organization_id()
    AND (auth.jwt()->'app_metadata'->>'role' = 'org_admin'
      OR (auth.jwt()->'app_metadata'->>'role' = 'nurse' AND EXISTS (
        SELECT 1 FROM public.shift_roster r WHERE r.organization_id = p_org
          AND r.shift_definition_id = p_shift AND r.shift_date = p_date AND r.user_id = auth.uid()
      )))
$$;
REVOKE ALL ON FUNCTION private.can_read_shift_tasks(uuid,uuid,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_shift_tasks(uuid,uuid,date) TO authenticated;

ALTER POLICY shift_tasks_staff_select ON public.shift_tasks TO authenticated
  USING (private.can_read_shift_tasks(organization_id, shift_definition_id, shift_date));
ALTER POLICY shift_tasks_staff_insert ON public.shift_tasks TO authenticated
  WITH CHECK (
    private.can_read_shift_tasks(organization_id, shift_definition_id, shift_date)
    AND created_by = auth.uid()
    AND (auth.jwt()->'app_metadata'->>'role' = 'org_admin'
      OR (source = 'MANUAL' AND status = 'PROPOSED' AND assignee_user_id IS NULL AND carried_from_task_id IS NULL)
      OR public.is_shift_lead(shift_definition_id, shift_date))
  );
ALTER POLICY shift_plan_approvals_staff_select ON public.shift_plan_approvals TO authenticated
  USING (private.can_read_shift_tasks(organization_id, shift_definition_id, shift_date));

-- Status transferu źródłowej zmiany nie wymaga odczytu treści zadania na zmianie docelowej.
CREATE FUNCTION public.read_shift_task_carries(p_shift uuid, p_date date)
RETURNS TABLE (task_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id FROM public.shift_tasks s WHERE s.organization_id = public.get_jwt_organization_id()
    AND s.shift_definition_id = p_shift AND s.shift_date = p_date AND public.staff_mfa_satisfied()
    AND public.has_org_feature(s.organization_id, 'module_shift_tasks')
    AND private.can_read_shift_tasks(s.organization_id, p_shift, p_date)
    AND EXISTS (SELECT 1 FROM public.shift_tasks n
      WHERE n.organization_id = s.organization_id AND n.carried_from_task_id = s.id)
$$;
REVOKE ALL ON FUNCTION public.read_shift_task_carries(uuid,date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_shift_task_carries(uuid,date) TO authenticated;

CREATE FUNCTION private.audit_manual_shift_task_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() = NEW.created_by THEN
    INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
    VALUES (NEW.organization_id, 'SHIFT_TASK_CREATED', auth.uid(), jsonb_build_object(
      'task_id', NEW.id, 'shift_definition_id', NEW.shift_definition_id, 'shift_date', NEW.shift_date,
      'status', NEW.status, 'assignee_id', NEW.assignee_user_id));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_manual_shift_task_added() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER shift_task_manual_created AFTER INSERT ON public.shift_tasks
FOR EACH ROW WHEN (NEW.source = 'MANUAL' AND NEW.carried_from_task_id IS NULL)
EXECUTE FUNCTION private.audit_manual_shift_task_added();

CREATE INDEX audit_logs_shift_lookup ON public.audit_logs
  (organization_id, (payload->>'shift_definition_id'), (payload->>'shift_date'), created_at DESC)
  WHERE action IN ('SHIFT_TASK_CREATED', 'SHIFT_TASK_STATUS_CHANGED', 'SHIFT_TASK_ASSIGNEE_CHANGED',
    'SHIFT_TASK_CARRIED', 'SHIFT_PLAN_APPROVED', 'SHIFT_PLAN_PRINTED', 'SHIFT_HANDOVER_APPROVED',
    'SHIFT_HANDOVER_AMENDMENT_APPROVED', 'SHIFT_HANDOVER_ACKNOWLEDGED', 'VOICE_SHIFT_TASK_DECIDED');
CREATE INDEX audit_logs_shift_transfer_lookup ON public.audit_logs
  (organization_id, (payload->>'source_shift_definition_id'), (payload->>'source_shift_date'), created_at DESC)
  WHERE action = 'SHIFT_TASK_CARRIED';

CREATE FUNCTION public.read_shift_handover_audit(p_shift uuid, p_date date, p_offset integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_shift public.shift_definitions := private.require_shift_handover_scope(p_shift, p_date);
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', id, 'action', action, 'actor', performed_by, 'at', created_at,
      'taskId', payload->'task_id', 'sourceTaskId', payload->'source_task_id', 'version', payload->'version',
      'previousVersion', payload->'previous_version', 'from', payload->'from', 'to', payload->'to',
      'assigneeId', payload->'assignee_id', 'previousAssigneeId', payload->'previous_assignee_id'
    )) ORDER BY created_at DESC, id DESC), '[]'::jsonb)
    FROM (
      SELECT id, action, performed_by, created_at, payload FROM public.audit_logs
      WHERE organization_id = v_shift.organization_id AND (
        (action IN ('SHIFT_TASK_CREATED', 'SHIFT_TASK_STATUS_CHANGED', 'SHIFT_TASK_ASSIGNEE_CHANGED',
          'SHIFT_TASK_CARRIED', 'SHIFT_PLAN_APPROVED', 'SHIFT_PLAN_PRINTED', 'SHIFT_HANDOVER_APPROVED',
          'SHIFT_HANDOVER_AMENDMENT_APPROVED', 'SHIFT_HANDOVER_ACKNOWLEDGED', 'VOICE_SHIFT_TASK_DECIDED')
          AND payload->>'shift_definition_id' = p_shift::text AND payload->>'shift_date' = p_date::text)
        OR (action = 'SHIFT_TASK_CARRIED' AND payload->>'source_shift_definition_id' = p_shift::text
          AND payload->>'source_shift_date' = p_date::text))
      ORDER BY created_at DESC, id DESC OFFSET greatest(p_offset, 0) LIMIT 51
    ) events
  );
END;
$$;
REVOKE ALL ON FUNCTION public.read_shift_handover_audit(uuid,date,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_shift_handover_audit(uuid,date,integer) TO authenticated;
