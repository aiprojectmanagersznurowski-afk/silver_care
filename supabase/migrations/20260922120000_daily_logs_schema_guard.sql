-- Migration: 20260922120000_daily_logs_schema_guard.sql
-- Wymusza, aby pole data w daily_logs było poprawnym obiektem JSON (nie tablicą ani wartością prostą)

ALTER TABLE public.daily_logs
  DROP CONSTRAINT IF EXISTS check_daily_logs_data_is_object;

ALTER TABLE public.daily_logs
  ADD CONSTRAINT check_daily_logs_data_is_object
  CHECK (jsonb_typeof(data) = 'object');
