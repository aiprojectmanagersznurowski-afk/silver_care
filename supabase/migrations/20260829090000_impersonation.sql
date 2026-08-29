-- Migration: 20260829090000_impersonation.sql

-- 1. Function to log impersonation start
CREATE OR REPLACE FUNCTION public.log_impersonation_start(p_target_admin_id uuid, p_target_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
BEGIN
  v_caller_id := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'sub', auth.uid()::text)::uuid;
  v_caller_role := coalesce(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '');

  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Only super_admin can log impersonation';
  END IF;

  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (
    p_target_org_id,
    'IMPERSONATE_START',
    v_caller_id,
    jsonb_build_object('target_admin_id', p_target_admin_id)
  );
END;
$$;

-- 2. Prevent hard deletes during impersonation
CREATE OR REPLACE FUNCTION public.hard_delete_resident(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'impersonator_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot perform destructive actions during impersonation';
  END IF;

  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.residents
    WHERE id = p_id
    AND organization_id = public.get_jwt_organization_id()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Redact audit logs instead of deleting
  UPDATE public.audit_logs
  SET payload = jsonb_set(payload, '{redacted}', 'true'::jsonb)
  WHERE resident_id = p_id;

  -- Delete resident (this will cascade to assignments, links, and ingest, but NOT audit_logs)
  DELETE FROM public.residents
  WHERE id = p_id;
END;
$$;
