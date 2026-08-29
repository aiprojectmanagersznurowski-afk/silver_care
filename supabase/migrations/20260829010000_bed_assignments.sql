-- Migration: 20260829010000_bed_assignments.sql

-- 1. Unique index to ensure one resident has at most one active bed
CREATE UNIQUE INDEX active_resident_assignment_idx ON public.bed_assignments (resident_id) WHERE unassigned_at IS NULL;

-- 2. Prevent assignment of archived resident
CREATE OR REPLACE FUNCTION public.prevent_archived_resident_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.unassigned_at IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.residents
      WHERE id = NEW.resident_id
      AND archived_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Cannot assign bed to an archived resident';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_archived_resident_assignment
  BEFORE INSERT OR UPDATE ON public.bed_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_archived_resident_assignment();

-- 3. Atomic transfer of resident to a new bed
CREATE OR REPLACE FUNCTION public.transfer_resident_bed(p_resident_id uuid, p_new_bed_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Close the old assignment
  UPDATE public.bed_assignments
  SET unassigned_at = now()
  WHERE resident_id = p_resident_id
  AND unassigned_at IS NULL;

  -- Create the new assignment
  INSERT INTO public.bed_assignments (bed_id, resident_id)
  VALUES (p_new_bed_id, p_resident_id);
END;
$$;
