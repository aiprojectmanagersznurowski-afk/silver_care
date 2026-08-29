-- Migration: 20260829020000_facility_occupancy.sql

-- 1. Occupied beds computed column
CREATE OR REPLACE FUNCTION public.occupied_beds(r public.rooms)
RETURNS bigint
LANGUAGE sql STABLE
AS $$
  SELECT count(*)
  FROM public.beds b
  JOIN public.bed_assignments ba ON ba.bed_id = b.id
  WHERE b.room_id = r.id
    AND b.deactivated_at IS NULL
    AND ba.unassigned_at IS NULL;
$$;

-- 2. Free beds computed column
CREATE OR REPLACE FUNCTION public.free_beds(r public.rooms)
RETURNS bigint
LANGUAGE sql STABLE
AS $$
  SELECT public.bed_count(r) - public.occupied_beds(r);
$$;
