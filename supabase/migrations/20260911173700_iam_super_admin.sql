-- Migration: 20260911173700_iam_super_admin.sql
-- REQ: SUP-IAM-PANEL — Super admin IAM panel, role change auditing, and RLS policies

-- 1. Allow nullable organization_id on audit_logs for global platform-level events
ALTER TABLE public.audit_logs ALTER COLUMN organization_id DROP NOT NULL;

-- 2. RLS policy for super_admin on audit_logs (read all audit logs across platform)
DROP POLICY IF EXISTS "audit_logs_super_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_super_admin_select" ON public.audit_logs
  FOR SELECT
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'super_admin'
  );

-- 3. Procedure to securely record role changes in audit_logs with validation
CREATE OR REPLACE FUNCTION public.log_role_change(
  p_target_user_id uuid,
  p_new_role text,
  p_previous_role text DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL
)
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
    RAISE EXCEPTION 'Only super_admin can change user roles' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_new_role NOT IN ('super_admin', 'org_admin', 'nurse', 'legal_guardian', 'family') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.audit_logs (
    organization_id,
    action,
    performed_by,
    payload
  ) VALUES (
    p_organization_id,
    'role_change',
    v_caller_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'new_role', p_new_role,
      'previous_role', p_previous_role,
      'changed_at', now()
    )
  );
END;
$$;
