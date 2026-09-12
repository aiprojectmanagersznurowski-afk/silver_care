-- Migration: 20260912210000_resident_metadata.sql
-- Extends resident model for BI reporting module (Dane Dzienne, Statystyka, Karta 360°)

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Extend residents table with metadata columns
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop the trigger that prevents editing archived residents temporarily
-- so we can add columns, then recreate
DROP TRIGGER IF EXISTS prevent_archived_resident_edit_trigger ON public.residents;

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('M', 'F', 'O')),
  ADD COLUMN IF NOT EXISTS admission_date date,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS contract_end_reason text,
  ADD COLUMN IF NOT EXISTS death_date date,
  ADD COLUMN IF NOT EXISTS care_level text CHECK (care_level IN ('walking', 'sitting', 'bedridden', 'hospice')),
  ADD COLUMN IF NOT EXISTS contract_source text,
  ADD COLUMN IF NOT EXISTS contract_monthly_rate numeric,
  ADD COLUMN IF NOT EXISTS notes text;

-- Backfill: set admission_date to created_at for existing residents
UPDATE public.residents
SET admission_date = created_at::date
WHERE admission_date IS NULL;

-- Recreate the trigger with updated field list
CREATE OR REPLACE FUNCTION public.prevent_archived_resident_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot edit an archived resident';
  END IF;
  
  -- If archiving now, prevent changing other fields
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN
    IF NEW.first_name <> OLD.first_name
       OR NEW.last_name <> OLD.last_name
       OR NEW.pesel_hash IS DISTINCT FROM OLD.pesel_hash
       OR NEW.organization_id <> OLD.organization_id
       OR NEW.birth_date IS DISTINCT FROM OLD.birth_date
       OR NEW.gender IS DISTINCT FROM OLD.gender
    THEN
      RAISE EXCEPTION 'Cannot edit other fields while archiving';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_archived_resident_edit_trigger
  BEFORE UPDATE ON public.residents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_archived_resident_edit();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Resident events — fact table for event sourcing
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.resident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.get_jwt_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL
    REFERENCES public.residents(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'contract_signed',
    'contract_ended',
    'death',
    'care_level_changed',
    'admission',
    'bed_transfer',
    'package_added',
    'package_removed'
  )),
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  event_reason text,             -- powód zakończenia umowy, etc.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,  -- dodatkowe dane per event
  performed_by uuid,             -- kto zarejestrował event
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resident_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resident_events_isolation" ON public.resident_events;
CREATE POLICY "resident_events_isolation" ON public.resident_events
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id()
  );

DROP POLICY IF EXISTS "resident_events_insert" ON public.resident_events;
CREATE POLICY "resident_events_insert" ON public.resident_events
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', ''
    ) IN ('org_admin', 'facility_manager', 'super_admin')
  );

-- Index for daily report queries (most common: by org + date range)
CREATE INDEX IF NOT EXISTS idx_resident_events_org_date
  ON public.resident_events (organization_id, event_date);

CREATE INDEX IF NOT EXISTS idx_resident_events_type_date
  ON public.resident_events (event_type, event_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Resident care level history — tracks changes over time
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.resident_care_level_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL
    REFERENCES public.residents(id) ON DELETE CASCADE,
  care_level text NOT NULL CHECK (care_level IN ('walking', 'sitting', 'bedridden', 'hospice')),
  changed_at date NOT NULL DEFAULT CURRENT_DATE,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resident_care_level_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "care_level_history_isolation" ON public.resident_care_level_history;
CREATE POLICY "care_level_history_isolation" ON public.resident_care_level_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.residents
      WHERE residents.id = resident_care_level_history.resident_id
      AND residents.organization_id = public.get_jwt_organization_id()
    )
  );

DROP POLICY IF EXISTS "care_level_history_insert" ON public.resident_care_level_history;
CREATE POLICY "care_level_history_insert" ON public.resident_care_level_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.residents
      WHERE residents.id = resident_id
      AND residents.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', ''
    ) IN ('org_admin', 'facility_manager', 'super_admin')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Resident packages — service packages (ZSN, rehabilitation, etc.)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.resident_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.get_jwt_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL
    REFERENCES public.residents(id) ON DELETE CASCADE,
  package_type text NOT NULL CHECK (package_type IN (
    'zsn',
    'rehabilitation',
    'physiotherapy',
    'speech_therapy',
    'other'
  )),
  package_name text NOT NULL,       -- human-readable name
  monthly_rate numeric,             -- cena pakietu
  started_at date NOT NULL DEFAULT CURRENT_DATE,
  ended_at date,                    -- NULL = active
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resident_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resident_packages_isolation" ON public.resident_packages;
CREATE POLICY "resident_packages_isolation" ON public.resident_packages
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id()
  );

DROP POLICY IF EXISTS "resident_packages_insert" ON public.resident_packages;
CREATE POLICY "resident_packages_insert" ON public.resident_packages
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', ''
    ) IN ('org_admin', 'facility_manager', 'super_admin')
  );

DROP POLICY IF EXISTS "resident_packages_update" ON public.resident_packages;
CREATE POLICY "resident_packages_update" ON public.resident_packages
  FOR UPDATE
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', ''
    ) IN ('org_admin', 'facility_manager', 'super_admin')
  );
