-- Migration: 20260829000000_facility_management.sql

-- 1. Add deactivated_at to rooms and beds
ALTER TABLE public.rooms ADD COLUMN deactivated_at timestamptz;
ALTER TABLE public.beds ADD COLUMN deactivated_at timestamptz;

-- 2. Add constraints for uniqueness
ALTER TABLE public.rooms ADD CONSTRAINT rooms_organization_id_name_key UNIQUE (organization_id, name);
ALTER TABLE public.beds ADD CONSTRAINT beds_room_id_label_key UNIQUE (room_id, label);

-- 2a. Add UPDATE policies for rooms and beds
CREATE POLICY "rooms_org_admin_update" ON public.rooms
  FOR UPDATE
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

CREATE POLICY "beds_org_admin_update" ON public.beds
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = room_id
      AND rooms.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

CREATE POLICY "bed_assignments_org_admin_update" ON public.bed_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.residents
      WHERE residents.id = resident_id
      AND residents.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

-- 3. Create function bed_count
CREATE OR REPLACE FUNCTION public.bed_count(r public.rooms)
RETURNS int
LANGUAGE sql STABLE
AS $$
  SELECT count(*)::int
  FROM public.beds b
  WHERE b.room_id = r.id
  AND b.deactivated_at IS NULL;
$$;

-- 4. Create trigger to prevent deactivation of beds with active assignments
CREATE OR REPLACE FUNCTION public.prevent_active_bed_deactivation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deactivated_at IS NOT NULL AND OLD.deactivated_at IS NULL THEN
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
  BEFORE UPDATE OF deactivated_at ON public.beds
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_active_bed_deactivation();
