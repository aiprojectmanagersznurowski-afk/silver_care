-- Migration: 20260915150000_pesel_encrypted_step_up.sql
-- REQ: SEC-PESEL-HASH, SEC-NO-PII-LOGS

ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS pesel_encrypted TEXT;

CREATE OR REPLACE FUNCTION public.log_pesel_access_attempt(
  p_resident_id uuid,
  p_status text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_org_id uuid;
BEGIN
  v_caller_id := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'sub', auth.uid()::text)::uuid;
  v_caller_role := coalesce(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '');
  v_org_id := (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id')::uuid;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.security_access_logs (
    organization_id,
    action,
    performed_by,
    payload
  ) VALUES (
    v_org_id,
    'pesel_reveal_attempt',
    v_caller_id,
    jsonb_build_object(
      'target_resident_id', p_resident_id,
      'status', p_status,
      'reason', p_reason,
      'timestamp', now()
    )
  );

  INSERT INTO public.audit_logs (
    organization_id,
    action,
    performed_by,
    payload
  ) VALUES (
    v_org_id,
    'pesel_reveal_' || lower(p_status),
    v_caller_id,
    jsonb_build_object(
      'target_resident_id', p_resident_id,
      'status', p_status,
      'reason', p_reason,
      'timestamp', now()
    )
  );
END;
$$;
