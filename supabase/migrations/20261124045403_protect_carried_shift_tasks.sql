-- @REQ: NUR-TASKS
-- @REQ: NUR-SHIFT-CLOSURE
-- Carry locks the original row before creating a copy. Status updates hold that
-- same row lock when this trigger checks for the copy, including direct writes.
CREATE FUNCTION private.guard_carried_shift_task_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.shift_tasks t WHERE t.organization_id = OLD.organization_id AND t.carried_from_task_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'SHIFT_TASK_ALREADY_CARRIED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_carried_shift_task_status() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER shift_task_carried_status_guard BEFORE UPDATE OF status ON public.shift_tasks
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION private.guard_carried_shift_task_status();
