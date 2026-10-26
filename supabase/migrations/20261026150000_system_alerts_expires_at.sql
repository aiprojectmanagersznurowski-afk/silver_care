-- SC-SUP-05: opcjonalny termin wygaśnięcia alertu systemowego (decyzja Michała 2026-10-26).
-- NULL = alert do ręcznego zakończenia (jak dotąd). Po terminie aplikacja traktuje alert jako „Wygasł”:
-- znika z banera i z aktywnych, w historii zostaje. Wiersz nie jest modyfikowany — stan wynika z czasu.
-- @REQ: SUP-IAM-PANEL

ALTER TABLE public.system_alerts
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.system_alerts
  DROP CONSTRAINT IF EXISTS system_alerts_expires_after_created;
ALTER TABLE public.system_alerts
  ADD CONSTRAINT system_alerts_expires_after_created CHECK (expires_at IS NULL OR expires_at > created_at);
