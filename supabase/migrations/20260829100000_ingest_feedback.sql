-- Migration: 20260829100000_ingest_feedback.sql

-- 1. Create report_feedback table (REPORT-AI-FEEDBACK)
CREATE TABLE IF NOT EXISTS public.report_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    reporter_id uuid NOT NULL,
    category text NOT NULL CHECK (category IN ('INACCURATE', 'HALLUCINATION', 'OTHER')),
    snapshot jsonb NOT NULL,
    prompt_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_feedback_isolation" ON public.report_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_reports
      JOIN public.residents ON residents.id = daily_reports.resident_id
      WHERE daily_reports.id = report_id
      AND residents.organization_id = public.get_jwt_organization_id()
    )
  );

CREATE POLICY "report_feedback_insert" ON public.report_feedback
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.daily_reports
      JOIN public.residents ON residents.id = daily_reports.resident_id
      WHERE daily_reports.id = report_id
      AND residents.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'nurse'
  );

-- Trigger to block publishing if feedback exists
CREATE OR REPLACE FUNCTION public.prevent_publishing_with_feedback()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'PUBLISHED' AND OLD.status <> 'PUBLISHED' THEN
    IF EXISTS (SELECT 1 FROM public.report_feedback WHERE report_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot publish a report that has pending feedback';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_publishing_with_feedback_trigger ON public.daily_reports;
CREATE TRIGGER prevent_publishing_with_feedback_trigger
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_publishing_with_feedback();

-- 2. Enhance ingest with deduplication and preconditions (INT-INGEST-PRECONDITIONS)
ALTER TABLE public.physiological_data_ingest
ADD COLUMN IF NOT EXISTS deduplication_id text UNIQUE;

CREATE OR REPLACE FUNCTION public.process_ingest_payload(
  p_org_id uuid,
  p_res_id uuid,
  p_metric text,
  p_value numeric,
  p_dedup_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is authorized for this organization (basic tenancy check)
  IF p_org_id <> public.get_jwt_organization_id() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- 1. Deduplication check
  IF EXISTS (SELECT 1 FROM public.physiological_data_ingest WHERE deduplication_id = p_dedup_id) THEN
    -- Silently ignore duplicate
    RETURN;
  END IF;

  -- 2. Resident archived check
  IF EXISTS (SELECT 1 FROM public.residents WHERE id = p_res_id AND archived_at IS NOT NULL) THEN
    INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
    VALUES (p_org_id, p_res_id, 'INGEST_REJECTED', '{"reason": "Resident archived"}'::jsonb);
    RETURN;
  END IF;

  -- 3. Consent check
  IF NOT EXISTS (
    SELECT 1 FROM public.consent_ledger
    WHERE resident_id = p_res_id
    AND purpose = 'wellness_data_ingest'
    AND revoked_at IS NULL
  ) THEN
    INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
    VALUES (p_org_id, p_res_id, 'INGEST_REJECTED', '{"reason": "No active consent"}'::jsonb);
    RETURN;
  END IF;

  -- All preconditions met, insert data
  INSERT INTO public.physiological_data_ingest (organization_id, resident_id, metric, value, deduplication_id)
  VALUES (p_org_id, p_res_id, p_metric, p_value, p_dedup_id);
END;
$$;
