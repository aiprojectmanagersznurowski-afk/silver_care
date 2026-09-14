-- Migration: 20260914200000_impersonation_guards.sql
-- REQ: SUP-IMPERSONATION — Impersonation stop logging and destructive action RLS triggers

-- 1. Funkcja logowania zakończenia impersonacji
CREATE OR REPLACE FUNCTION public.log_impersonation_stop(p_target_admin_id uuid, p_target_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'impersonator_id',
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub',
    auth.uid()::text
  )::uuid;

  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (
    p_target_org_id,
    'IMPERSONATE_STOP',
    v_caller_id,
    jsonb_build_object('target_admin_id', p_target_admin_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_impersonation_stop(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_impersonation_stop(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_impersonation_stop(uuid, uuid) TO authenticated;

-- 2. Trigger blokujący akcje destrukcyjne (kasowanie pensjonariuszy) w sesji z claimem impersonator_id
CREATE OR REPLACE FUNCTION public.check_impersonation_destruct_block()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'impersonator_id', '') <> '' THEN
    RAISE EXCEPTION 'Cannot perform destructive actions during impersonation' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_destructive_during_impersonation ON public.residents;
CREATE TRIGGER trg_prevent_destructive_during_impersonation
  BEFORE DELETE ON public.residents
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.check_impersonation_destruct_block();
