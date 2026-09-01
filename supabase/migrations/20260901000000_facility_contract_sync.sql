-- Migration: 20260901000000_facility_contract_sync.sql

-- 1. Rename column 'name' to 'number' in rooms
ALTER TABLE public.rooms DROP CONSTRAINT rooms_organization_id_name_key;
ALTER TABLE public.rooms RENAME COLUMN name TO number;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_organization_id_number_key UNIQUE (organization_id, number);

-- 2. Add 'floor' and 'sector' columns
ALTER TABLE public.rooms ADD COLUMN floor text NOT NULL DEFAULT '';
ALTER TABLE public.rooms ADD COLUMN sector text;

-- 3. Transition from 'deactivated_at' to 'is_active'
ALTER TABLE public.rooms ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.beds ADD COLUMN is_active boolean NOT NULL DEFAULT true;

UPDATE public.rooms SET is_active = false WHERE deactivated_at IS NOT NULL;
UPDATE public.beds SET is_active = false WHERE deactivated_at IS NOT NULL;

-- Remove old columns
DROP TRIGGER IF EXISTS check_active_bed_deactivation ON public.beds;
ALTER TABLE public.rooms DROP COLUMN deactivated_at;
ALTER TABLE public.beds DROP COLUMN deactivated_at;

-- 4. Recreate functions depending on 'deactivated_at'
CREATE OR REPLACE FUNCTION public.bed_count(r public.rooms)
RETURNS int
LANGUAGE sql STABLE
AS $$
  SELECT count(*)::int
  FROM public.beds b
  WHERE b.room_id = r.id
  AND b.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.occupied_beds(r public.rooms)
RETURNS bigint
LANGUAGE sql STABLE
AS $$
  SELECT count(*)
  FROM public.beds b
  JOIN public.bed_assignments ba ON ba.bed_id = b.id
  WHERE b.room_id = r.id
    AND b.is_active = true
    AND ba.unassigned_at IS NULL;
$$;

-- 5. Recreate trigger 'prevent_active_bed_deactivation'
CREATE OR REPLACE FUNCTION public.prevent_active_bed_deactivation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    IF EXISTS (
      SELECT 1 FROM public.bed_assignments
      WHERE bed_id = NEW.id
      AND unassigned_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot deactivate bed with active assignment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_active_bed_deactivation
  BEFORE UPDATE OF is_active ON public.beds
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_active_bed_deactivation();
