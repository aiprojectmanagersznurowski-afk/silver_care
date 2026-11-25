-- @REQ: ADM-RESIDENT-ADD @REQ: ADM-CAPACITY-LIMIT @REQ: ORG-ISOLATION
CREATE FUNCTION public.commit_resident_import(p_rows jsonb, p_confirm_capacity boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_org uuid := public.get_jwt_organization_id();
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Europe/Warsaw')::date;
  v_limit integer;
  v_projected integer;
  v_inserted integer;
BEGIN
  IF v_org IS NULL OR v_user IS NULL OR auth.jwt()->'app_metadata'->>'role' IS DISTINCT FROM 'org_admin'
    OR public.staff_mfa_satisfied() IS DISTINCT FROM true
    OR public.has_org_feature(v_org, 'module_residents_management') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RESIDENT_IMPORT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'RESIDENT_IMPORT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) AS r(row)
    WHERE NULLIF(btrim(row->>'pesel_hash'), '') IS NULL
      OR NULLIF(btrim(row->>'first_name'), '') IS NULL OR NULLIF(btrim(row->>'last_name'), '') IS NULL) THEN
    RAISE EXCEPTION 'RESIDENT_IMPORT_INVALID' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text, 1273));
  SELECT COALESCE(resident_limit, 50) INTO STRICT v_limit FROM public.organizations WHERE id = v_org;
  SELECT count(*) + jsonb_array_length(p_rows) INTO v_projected FROM public.residents
  WHERE organization_id = v_org AND archived_at IS NULL AND death_date IS NULL
    AND (contract_end_date IS NULL OR contract_end_date > v_today);
  IF v_projected > v_limit AND p_confirm_capacity IS NOT TRUE THEN
    RAISE EXCEPTION 'RESIDENT_IMPORT_CAPACITY_CONFIRMATION' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.residents (
    organization_id, first_name, last_name, pesel_hash, gender, birth_date, care_level, is_zsn, notes, admission_date
  )
  SELECT v_org, r.first_name, r.last_name, r.pesel_hash, r.gender, r.birth_date, r.care_level, r.is_zsn, r.notes, r.admission_date
  FROM jsonb_populate_recordset(NULL::public.residents, p_rows) AS r;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (v_org, 'RESIDENTS_BULK_IMPORT', v_user, jsonb_build_object(
    'imported_count', v_inserted, 'source', 'excel_csv_import', 'capacity_exceeded', v_projected > v_limit));
  IF v_projected > v_limit THEN
    INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
    VALUES (v_org, 'ORGANIZATION_CAPACITY_EXCEEDED', v_user, jsonb_build_object(
      'operation', 'resident_bulk_import', 'counts', 'residents', 'resident_limit', v_limit,
      'projected_count', v_projected, 'excess', v_projected - v_limit));
  END IF;
  RETURN jsonb_build_object('importedCount', v_inserted, 'residentLimit', v_limit, 'activeResidents', v_projected);
END $$;

REVOKE ALL ON FUNCTION public.commit_resident_import(jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_resident_import(jsonb,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
