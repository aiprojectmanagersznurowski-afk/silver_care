-- Migration: 20260915170000_outbox_concurrency_skip_locked.sql
-- Description: Transakcyjne pobieranie powiadomień outbox (FOR UPDATE SKIP LOCKED) oraz mechanizm retry i backoff

-- 1. Rozszerzenie statusów i dodanie kolumn sterujących ponowieniami
ALTER TABLE public.outbox_notifications 
  DROP CONSTRAINT IF EXISTS outbox_notifications_status_check;

ALTER TABLE public.outbox_notifications 
  ADD CONSTRAINT outbox_notifications_status_check 
  CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'));

ALTER TABLE public.outbox_notifications
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_error text;

-- 2. Indeksy pod wydajne pobieranie z kolejki
CREATE INDEX IF NOT EXISTS idx_outbox_notifications_queue 
  ON public.outbox_notifications (status, next_retry_at, created_at)
  WHERE status IN ('PENDING', 'PROCESSING');

-- 3. Funkcja RPC do atomowego pobierania powiadomień z kolejki (SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.fetch_pending_outbox_notifications(
  p_batch_size int DEFAULT 50,
  p_lock_timeout_minutes int DEFAULT 10
)
RETURNS SETOF public.outbox_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  WITH available_records AS (
    SELECT id
    FROM public.outbox_notifications
    WHERE 
      (status = 'PENDING' AND next_retry_at <= now())
      OR (status = 'PROCESSING' AND locked_at < now() - (p_lock_timeout_minutes || ' minutes')::interval)
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.outbox_notifications o
  SET 
    status = 'PROCESSING',
    locked_at = now()
  FROM available_records a
  WHERE o.id = a.id
  RETURNING o.*;
END;
$$;

-- 4. Funkcja RPC do aktualizacji statusu po próbie wysyłki (sukces lub błąd z backoffem)
CREATE OR REPLACE FUNCTION public.handle_outbox_notification_attempt(
  p_notification_id uuid,
  p_success boolean,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_attempts int;
  v_max_attempts int;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
  FROM public.outbox_notifications
  WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_success THEN
    UPDATE public.outbox_notifications
    SET 
      status = 'PROCESSED',
      locked_at = NULL,
      last_error = NULL
    WHERE id = p_notification_id;
  ELSE
    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      UPDATE public.outbox_notifications
      SET 
        status = 'FAILED',
        attempts = v_attempts,
        locked_at = NULL,
        last_error = p_error_message
      WHERE id = p_notification_id;
    ELSE
      -- Wykładniczy backoff: 2 min * liczba dotychczasowych prób
      UPDATE public.outbox_notifications
      SET 
        status = 'PENDING',
        attempts = v_attempts,
        locked_at = NULL,
        next_retry_at = now() + (v_attempts * INTERVAL '2 minutes'),
        last_error = p_error_message
      WHERE id = p_notification_id;
    END IF;
  END IF;
END;
$$;
