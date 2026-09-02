-- Migration: Add followup fields to voice_draft_notes (VOICE-FOLLOWUP)
ALTER TABLE public.voice_draft_notes ADD COLUMN IF NOT EXISTS followup_question TEXT;
-- Status can now also be 'NEEDS_FOLLOWUP'
