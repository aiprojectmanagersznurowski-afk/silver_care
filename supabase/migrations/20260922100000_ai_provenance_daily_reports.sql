-- Add AI provenance columns to daily_reports table (SC-NUR-03/AC1, ADR-007)
-- AI_PROVENANCE_FIELDS: ai_model, ai_prompt_version, ai_generated_at, approved_by, approved_at

ALTER TABLE public.daily_reports 
    ADD COLUMN IF NOT EXISTS ai_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_prompt_version TEXT,
    ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Trigger to set approved_at when report status changes to PUBLISHED
CREATE OR REPLACE FUNCTION public.set_report_approved_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'PUBLISHED' AND (OLD.status IS DISTINCT FROM 'PUBLISHED') THEN
        NEW.approved_at = NOW();
        NEW.approved_by = COALESCE(NEW.approved_by, auth.uid());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_report_approved_at ON public.daily_reports;
CREATE TRIGGER trigger_set_report_approved_at
    BEFORE UPDATE ON public.daily_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.set_report_approved_at();
