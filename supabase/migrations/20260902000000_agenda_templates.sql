-- Migration: Add is_template column for day templates (NUR-AGENDA)
ALTER TABLE public.agenda_items ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;
