-- Migration: 20260829040000_archive_audit.sql

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    resident_id uuid, -- No FK to avoid cascade delete on hard delete
    action text NOT NULL,
    performed_by uuid, -- Typically auth.uid(), keeping generic for MVP
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_isolation" ON public.audit_logs;
CREATE POLICY "audit_logs_isolation" ON public.audit_logs
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id()
  );

-- 2. Trigger to prevent editing archived residents
CREATE OR REPLACE FUNCTION public.prevent_archived_resident_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot edit an archived resident';
  END IF;
  
  -- If archiving now, prevent changing other fields
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN
    IF NEW.first_name <> OLD.first_name OR NEW.last_name <> OLD.last_name OR NEW.pesel_hash IS DISTINCT FROM OLD.pesel_hash OR NEW.organization_id <> OLD.organization_id THEN
      RAISE EXCEPTION 'Cannot edit other fields while archiving';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_archived_resident_edit_trigger ON public.residents;
CREATE TRIGGER prevent_archived_resident_edit_trigger
  BEFORE UPDATE ON public.residents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_archived_resident_edit();

-- 3. Create physiological_data_ingest table (Ingest layer mockup)
CREATE TABLE IF NOT EXISTS public.physiological_data_ingest (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    metric text NOT NULL,
    value numeric NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.physiological_data_ingest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingest_isolation" ON public.physiological_data_ingest;
CREATE POLICY "ingest_isolation" ON public.physiological_data_ingest
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id()
  );

-- RLS prevents insert if resident is archived
DROP POLICY IF EXISTS "ingest_insert_active_only" ON public.physiological_data_ingest;
CREATE POLICY "ingest_insert_active_only" ON public.physiological_data_ingest
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    EXISTS (
      SELECT 1 FROM public.residents
      WHERE residents.id = resident_id
      AND residents.organization_id = public.get_jwt_organization_id()
      AND residents.archived_at IS NULL
    )
  );

-- 4. Hard delete RPC
CREATE OR REPLACE FUNCTION public.hard_delete_resident(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
