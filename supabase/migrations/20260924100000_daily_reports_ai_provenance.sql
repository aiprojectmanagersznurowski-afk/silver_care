-- Migration: 20260924100000_daily_reports_ai_provenance.sql
-- Dodanie kolumn metadanych pochodzenia AI (AI_PROVENANCE_FIELDS) zgodnie z voice.contract.mjs

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS ai_model TEXT,
  ADD COLUMN IF NOT EXISTS ai_prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.daily_reports.ai_model IS 'Identyfikator europejskiego modelu AI generującego raport (zgodność z voice.contract.mjs)';
COMMENT ON COLUMN public.daily_reports.ai_prompt_version IS 'Wersja semantyczna promptu systemowego (AI_PROVENANCE_FIELDS)';
COMMENT ON COLUMN public.daily_reports.ai_generated_at IS 'Data i czas wygenerowania szkicu przez AI (AI_PROVENANCE_FIELDS)';
