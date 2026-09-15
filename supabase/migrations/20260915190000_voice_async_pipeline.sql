-- Migration: 20260915190000_voice_async_pipeline.sql
-- Description: Asynchroniczne przetwarzanie notatek głosowych z kolejkowaniem i obsługą prób (VOICE-ASYNC-PIPELINE)

-- 1. Dodanie kolumn stanu kolejki do voice_draft_notes
ALTER TABLE public.voice_draft_notes
  ADD COLUMN IF NOT EXISTS async_status text DEFAULT 'IDLE' 
    CHECK (async_status IN ('IDLE', 'QUEUED', 'TRANSCRIBING', 'CLASSIFYING', 'READY_FOR_APPROVAL', 'NEEDS_FOLLOWUP', 'FAILED_TRANSIENT', 'FAILED_PERMANENT')),
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- 2. Indeks dla zadań oczekujących w kolejce
CREATE INDEX IF NOT EXISTS idx_voice_draft_notes_queue
  ON public.voice_draft_notes (async_status, created_at)
  WHERE async_status IN ('QUEUED', 'TRANSCRIBING', 'CLASSIFYING');

-- 3. Funkcja do atomowego pobrania zadania z kolejki (SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.fetch_next_voice_job()
RETURNS public.voice_draft_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_job public.voice_draft_notes;
BEGIN
  SELECT * INTO v_job
  FROM public.voice_draft_notes
  WHERE 
    async_status = 'QUEUED'
    OR (async_status = 'TRANSCRIBING' AND processing_started_at < now() - INTERVAL '5 minutes')
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    UPDATE public.voice_draft_notes
    SET 
      async_status = 'TRANSCRIBING',
      attempts = attempts + 1,
      processing_started_at = now()
    WHERE id = v_job.id
    RETURNING * INTO v_job;
  END IF;

  RETURN v_job;
END;
$$;
