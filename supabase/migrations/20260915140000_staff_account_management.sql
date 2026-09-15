-- Migration: 20260915140000_staff_account_management.sql
-- REQ: ORG-ISOLATION, SEC-AUDIT-APPEND-ONLY

CREATE OR REPLACE FUNCTION public.log_staff_management_action(
  p_target_user_id uuid,
  p_action text,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_caller_org uuid;
BEGIN
  v_caller_id := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'sub', auth.uid()::text)::uuid;
  v_caller_role := coalesce(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '');
  v_caller_org := (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id')::uuid;

  IF v_caller_role NOT IN ('org_admin', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'Only org_admin or super_admin can manage staff accounts' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_caller_role = 'org_admin' AND (v_caller_org IS NULL OR v_caller_org <> p_organization_id) THEN
    RAISE EXCEPTION 'Cannot manage staff from another organization' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.audit_logs (
    organization_id,
    action,
    performed_by,
    payload
  ) VALUES (
    p_organization_id,
    p_action,
    v_caller_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'timestamp', now()
    )
  );
END;
$$;
