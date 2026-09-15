-- Migration: 20260915160000_admit_resident_with_bed.sql
-- REQ: ADM-RESIDENT-ADD, ADM-BED-ASSIGNMENT

CREATE OR REPLACE FUNCTION public.admit_resident_with_bed(
  p_first_name text,
  p_last_name text,
  p_pesel_hash text,
  p_pesel_encrypted text,
  p_gender text,
  p_birth_date date,
  p_care_level text,
  p_is_zsn boolean DEFAULT false,
  p_bed_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_org_id uuid;
  v_resident_id uuid;
  v_assignment_id uuid;
BEGIN
  v_caller_id := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'sub', auth.uid()::text)::uuid;
  v_caller_role := coalesce(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '');
  v_org_id := (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id')::uuid;

  IF v_caller_role NOT IN ('org_admin', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'Only org_admin can admit residents' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Missing organization_id in token' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 1. Check duplicate pesel_hash within organization
  IF EXISTS (SELECT 1 FROM public.residents WHERE organization_id = v_org_id AND pesel_hash = p_pesel_hash) THEN
    RAISE EXCEPTION 'Resident with this pesel_hash already exists in organization' USING ERRCODE = 'unique_violation';
  END IF;

  -- 2. Insert resident
  INSERT INTO public.residents (
    organization_id,
    first_name,
    last_name,
    pesel_hash,
    pesel_encrypted,
    gender,
    birth_date,
    care_level,
    is_zsn,
    admission_date,
    notes
  ) VALUES (
    v_org_id,
    p_first_name,
    p_last_name,
    p_pesel_hash,
    p_pesel_encrypted,
    p_gender,
    p_birth_date,
    p_care_level,
    COALESCE(p_is_zsn, false),
    CURRENT_DATE,
    p_notes
  ) RETURNING id INTO v_resident_id;

  -- 3. If bed_id provided, check and assign
  IF p_bed_id IS NOT NULL THEN
    -- Lock and check if bed is already occupied
    IF EXISTS (
      SELECT 1 FROM public.bed_assignments
      WHERE bed_id = p_bed_id AND unassigned_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Bed % is already occupied', p_bed_id USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO public.bed_assignments (
      bed_id,
      resident_id
    ) VALUES (
      p_bed_id,
      v_resident_id
    ) RETURNING id INTO v_assignment_id;
  END IF;

  -- 4. Audit log
  INSERT INTO public.audit_logs (
    organization_id,
    action,
    performed_by,
    payload
  ) VALUES (
    v_org_id,
    'resident_admitted',
    v_caller_id,
    jsonb_build_object(
      'resident_id', v_resident_id,
      'assigned_bed_id', p_bed_id,
      'has_bed', (p_bed_id IS NOT NULL),
      'timestamp', now()
    )
  );

  RETURN jsonb_build_object(
    'resident_id', v_resident_id,
    'bed_assignment_id', v_assignment_id,
    'status', 'admitted'
  );
END;
$$;
