-- @REQ: NUR-TASKS
-- @REQ: SEC-MFA-STAFF
ALTER FUNCTION public.settle_shift_task(uuid,text,text,uuid,date) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.settle_shift_task(uuid,text,text,uuid,date) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.settle_shift_task(
  p_task_id uuid, p_path text, p_reason text, p_target_definition_id uuid, p_target_date date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.staff_mfa_satisfied()
    OR auth.jwt()->'app_metadata'->>'impersonator_id' IS NOT NULL
    OR auth.jwt()->'app_metadata'->>'is_active' = 'false' THEN
    RAISE EXCEPTION 'SHIFT_TASK_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN private.settle_shift_task(p_task_id, p_path, p_reason, p_target_definition_id, p_target_date);
END;
$$;
REVOKE ALL ON FUNCTION public.settle_shift_task(uuid,text,text,uuid,date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_shift_task(uuid,text,text,uuid,date) TO authenticated;
