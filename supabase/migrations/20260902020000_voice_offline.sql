-- Migration: Add client_uuid to voice_draft_notes (VOICE-OFFLINE)
-- Umożliwia synchronizację notatek utworzonych w trybie offline w urządzeniu klienta.
ALTER TABLE public.voice_draft_notes ADD COLUMN IF NOT EXISTS client_uuid UUID UNIQUE;
