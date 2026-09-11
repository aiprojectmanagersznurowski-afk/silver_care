-- Migration: 20260911214000_iam_password_reset.sql
-- REQ: SUP-IAM-PANEL — Procedure to securely log password reset in audit_logs

CREATE OR REPLACE FUNCTION public.log_password_reset(
  p_target_user_id uuid,
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
    RAISE EXCEPTION 'Only super_admin can reset user passwords' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.audit_logs (
    organization_id,
    action,
    performed_by,
    payload
  ) VALUES (
    p_organization_id,
    'password_reset',
    v_caller_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'changed_at', now()
    )
  );
END;
$$;
