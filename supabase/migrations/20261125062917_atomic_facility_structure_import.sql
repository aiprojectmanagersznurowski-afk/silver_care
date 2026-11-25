-- @REQ: ADM-FACILITY-MANAGE @REQ: ADM-CAPACITY-LIMIT @REQ: ORG-ISOLATION
CREATE FUNCTION public.commit_facility_structure(p_rooms jsonb, p_confirm_capacity boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_org uuid := public.get_jwt_organization_id();
  v_user uuid := auth.uid();
  v_room jsonb;
  v_room_id uuid;
  v_rooms integer := 0;
  v_beds integer;
  v_limit integer;
  v_projected integer;
BEGIN
  IF v_org IS NULL OR v_user IS NULL OR auth.jwt()->'app_metadata'->>'role' IS DISTINCT FROM 'org_admin'
    OR NOT public.staff_mfa_satisfied()
    OR NOT public.has_org_feature(v_org, 'module_facility_management') THEN
    RAISE EXCEPTION 'FACILITY_IMPORT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rooms) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rooms) = 0 THEN
    RAISE EXCEPTION 'FACILITY_IMPORT_INVALID' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text, 1272));
  SELECT resident_limit INTO STRICT v_limit FROM public.organizations WHERE id = v_org;
  SELECT COALESCE(sum(jsonb_array_length(value->'bedLabels')), 0) INTO v_beds FROM jsonb_array_elements(p_rooms);
  SELECT count(*) + v_beds INTO v_projected
  FROM public.beds b JOIN public.rooms r ON r.id = b.room_id
  WHERE r.organization_id = v_org AND b.is_active;
  IF v_projected > v_limit AND p_confirm_capacity IS NOT TRUE THEN
    RAISE EXCEPTION 'FACILITY_IMPORT_CAPACITY_CONFIRMATION' USING ERRCODE = '23514';
  END IF;

  FOR v_room IN SELECT value FROM jsonb_array_elements(p_rooms)
  LOOP
    INSERT INTO public.rooms (organization_id, number, floor, sector)
    VALUES (v_org, v_room->>'number', v_room->>'floor', v_room->>'sector') RETURNING id INTO v_room_id;
    INSERT INTO public.beds (room_id, label)
    SELECT v_room_id, label FROM jsonb_array_elements_text(v_room->'bedLabels') AS labels(label);
    v_rooms := v_rooms + 1;
  END LOOP;

  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (v_org, 'FACILITY_SCHEMA_IMPORTED', v_user, jsonb_build_object('imported_rooms', v_rooms, 'imported_beds', v_beds));
  IF v_projected > v_limit THEN
    INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
    VALUES (v_org, 'ORGANIZATION_CAPACITY_EXCEEDED', v_user, jsonb_build_object(
      'operation', 'bed_create', 'counts', 'beds', 'resident_limit', v_limit,
      'projected_count', v_projected, 'excess', v_projected - v_limit));
  END IF;
  RETURN jsonb_build_object('rooms', v_rooms, 'beds', v_beds, 'capacityExceeded', v_projected > v_limit);
END $$;
REVOKE ALL ON FUNCTION public.commit_facility_structure(jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_facility_structure(jsonb,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
