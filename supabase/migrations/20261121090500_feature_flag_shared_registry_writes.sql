-- @REQ: SUP-FEATURE-FLAGS
-- Shared reference reads are used by independent modules and keep their tenant and role RLS.

CREATE POLICY feature_residents_insert ON public.residents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_org_feature(organization_id, 'module_residents_management'));

CREATE POLICY feature_residents_update ON public.residents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_org_feature(organization_id, 'module_residents_management'));

CREATE POLICY feature_residents_delete ON public.residents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_org_feature(organization_id, 'module_residents_management'));

CREATE POLICY feature_rooms_insert ON public.rooms AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_org_feature(organization_id, 'module_facility_management'));

CREATE POLICY feature_rooms_update ON public.rooms AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_org_feature(organization_id, 'module_facility_management'));

CREATE POLICY feature_rooms_delete ON public.rooms AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_org_feature(organization_id, 'module_facility_management'));

CREATE POLICY feature_beds_insert ON public.beds AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = beds.room_id AND public.has_org_feature(r.organization_id, 'module_facility_management')
  ));

CREATE POLICY feature_beds_update ON public.beds AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = beds.room_id AND public.has_org_feature(r.organization_id, 'module_facility_management')
  ));

CREATE POLICY feature_beds_delete ON public.beds AS RESTRICTIVE FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = beds.room_id AND public.has_org_feature(r.organization_id, 'module_facility_management')
  ));

CREATE POLICY feature_bed_assignments_insert ON public.bed_assignments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.beds b
    JOIN public.rooms r ON r.id = b.room_id
    JOIN public.residents res ON res.organization_id = r.organization_id
    WHERE b.id = bed_assignments.bed_id AND res.id = bed_assignments.resident_id
      AND public.has_org_feature(r.organization_id, 'module_facility_management')
  ));

CREATE POLICY feature_bed_assignments_update ON public.bed_assignments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.beds b
    JOIN public.rooms r ON r.id = b.room_id
    JOIN public.residents res ON res.organization_id = r.organization_id
    WHERE b.id = bed_assignments.bed_id AND res.id = bed_assignments.resident_id
      AND public.has_org_feature(r.organization_id, 'module_facility_management')
  ));

CREATE POLICY feature_bed_assignments_delete ON public.bed_assignments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.beds b
    JOIN public.rooms r ON r.id = b.room_id
    JOIN public.residents res ON res.organization_id = r.organization_id
    WHERE b.id = bed_assignments.bed_id AND res.id = bed_assignments.resident_id
      AND public.has_org_feature(r.organization_id, 'module_facility_management')
  ));

CREATE OR REPLACE FUNCTION public.transfer_resident_bed(p_resident_id uuid, p_new_bed_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.beds b
    JOIN public.rooms r ON r.id = b.room_id
    JOIN public.residents res ON res.organization_id = r.organization_id
    WHERE b.id = p_new_bed_id AND res.id = p_resident_id
      AND public.has_org_feature(r.organization_id, 'module_facility_management')
  ) THEN
    RAISE EXCEPTION 'Bed transfer unavailable' USING ERRCODE = '42501';
  END IF;

  UPDATE public.bed_assignments
  SET unassigned_at = now()
  WHERE resident_id = p_resident_id AND unassigned_at IS NULL;

  INSERT INTO public.bed_assignments (bed_id, resident_id)
  VALUES (p_new_bed_id, p_resident_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.transfer_resident_bed(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_resident_bed(uuid, uuid) TO authenticated, service_role;
