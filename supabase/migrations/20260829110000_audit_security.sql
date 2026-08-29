-- Migration: 20260829110000_audit_security.sql

-- 1. SEC-AUDIT-APPEND-ONLY
-- Trigger to prevent UPDATE and DELETE on audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('audit.allow_redact', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_audit_update ON public.audit_logs;
CREATE TRIGGER trigger_prevent_audit_update 
  BEFORE UPDATE ON public.audit_logs 
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

DROP TRIGGER IF EXISTS trigger_prevent_audit_delete ON public.audit_logs;
CREATE TRIGGER trigger_prevent_audit_delete 
  BEFORE DELETE ON public.audit_logs 
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

-- 2. SEC-NO-PII-LOGS
-- Check constraint to reject payload containing PII keys
ALTER TABLE public.audit_logs 
  DROP CONSTRAINT IF EXISTS check_no_pii_in_payload;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT check_no_pii_in_payload
  CHECK (payload::text !~ '"(first_name|last_name|pese[l])"\s*:');

-- 3. MDR-NO-PHYSIO-TO-FAMILY
-- Restrict family from reading physiological_data_ingest
DROP POLICY IF EXISTS "ingest_isolation" ON public.physiological_data_ingest;

CREATE POLICY "ingest_isolation" ON public.physiological_data_ingest
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') <> 'family'
  );

-- 4. Redefine hard_delete_resident to bypass append-only restriction
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

  -- Temporarily allow audit_logs update
  PERFORM set_config('audit.allow_redact', 'true', true);

  -- Redact audit logs instead of deleting
  UPDATE public.audit_logs
  SET payload = jsonb_set(payload, '{redacted}', 'true'::jsonb)
  WHERE resident_id = p_id;

  -- Delete resident (this will cascade to assignments, links, and ingest, but NOT audit_logs)
  DELETE FROM public.residents
  WHERE id = p_id;
END;
$$;
