-- R4: usunięcie dawnych ról (admin, facility_manager, caregiver, paramedic) z bazy.
-- Decyzja Michała 2026-10-26. Role wyłącznie z kontraktu: super_admin, org_admin, nurse, legal_guardian, family.
--
-- Definicje poniżej odtworzone z katalogu żywej bazy (pg_policies, pg_get_functiondef), nie z wcześniejszych migracji,
-- bo część z nich była później nadpisana. Zmienione są tylko listy ról i źródło roli/placówki.
--
-- 1. Polityki zapisu zdarzeń pobytu, pakietów i historii poziomu opieki: bez facility_manager.
-- 2. admit_resident_with_bed, log_staff_management_action: bez roli admin. W log_staff_management_action
--    rola admin omijała sprawdzenie placówki (sprawdzane było tylko org_admin). Dodany search_path.
-- 3. get_superadmin_organization_summary: personel liczony tylko z app_metadata (user_metadata edytuje użytkownik).
-- 4. Dane: usunięcie role/organization_id z raw_user_meta_data (7 kont w chwili pisania).

-- 1. Polityki --------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "care_level_history_insert" ON public.resident_care_level_history;
CREATE POLICY "care_level_history_insert" ON public.resident_care_level_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.residents
      WHERE residents.id = resident_care_level_history.resident_id
        AND residents.organization_id = public.get_jwt_organization_id()
    )
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = ANY (ARRAY['org_admin', 'super_admin'])
  );

DROP POLICY IF EXISTS "resident_events_insert" ON public.resident_events;
CREATE POLICY "resident_events_insert" ON public.resident_events
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id()
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = ANY (ARRAY['org_admin', 'super_admin'])
  );

DROP POLICY IF EXISTS "resident_packages_insert" ON public.resident_packages;
CREATE POLICY "resident_packages_insert" ON public.resident_packages
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id()
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = ANY (ARRAY['org_admin', 'super_admin'])
  );

DROP POLICY IF EXISTS "resident_packages_update" ON public.resident_packages;
CREATE POLICY "resident_packages_update" ON public.resident_packages
  FOR UPDATE
  USING (
    organization_id = public.get_jwt_organization_id()
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = ANY (ARRAY['org_admin', 'super_admin'])
  );

-- 2. Funkcje bez roli admin ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admit_resident_with_bed(p_first_name text, p_last_name text, p_pesel_hash text, p_gender text, p_birth_date date, p_care_level text, p_is_zsn boolean DEFAULT false, p_bed_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  IF v_caller_role NOT IN ('org_admin', 'super_admin') THEN
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
    p_gender,
    p_birth_date,
    p_care_level,
    COALESCE(p_is_zsn, false),
    CURRENT_DATE,
    p_notes
  ) RETURNING id INTO v_resident_id;

  -- 3. If bed_id provided, check organization and occupancy, then assign (Tenant Isolation)
  IF p_bed_id IS NOT NULL THEN
    -- Check if bed belongs to caller's organization
    IF NOT EXISTS (
      SELECT 1 FROM public.beds b
      JOIN public.rooms r ON b.room_id = r.id
      WHERE b.id = p_bed_id AND r.organization_id = v_org_id
    ) THEN
      RAISE EXCEPTION 'Bed % does not belong to organization', p_bed_id USING ERRCODE = 'check_violation';
    END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.log_staff_management_action(p_target_user_id uuid, p_action text, p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_caller_org uuid;
BEGIN
  v_caller_id := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'sub', auth.uid()::text)::uuid;
  v_caller_role := coalesce(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '');
  v_caller_org := (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id')::uuid;

  IF v_caller_role NOT IN ('org_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only org_admin or super_admin can manage staff accounts' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_caller_role = 'org_admin' AND (v_caller_org IS NULL OR v_caller_org <> p_organization_id) THEN
    RAISE EXCEPTION 'Cannot manage staff from another organization' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.audit_logs (
    organization_id,
    action,
    performed_by,
    payload
  ) VALUES (
    p_organization_id,
    p_action,
    v_caller_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'timestamp', now()
    )
  );
END;
$function$;

-- 3. Podsumowanie placówek tylko z app_metadata ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_superadmin_organization_summary()
 RETURNS TABLE(organization_id uuid, organization_name text, address text, resident_limit integer, created_at timestamp with time zone, active_resident_count bigint, staff_count bigint, administrator_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  v_caller_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
    ''
  );

  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Odmowa dostępu: Wymagana rola super_admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    org.id AS organization_id,
    org.name AS organization_name,
    org.address,
    COALESCE(org.resident_limit, 50) AS resident_limit,
    org.created_at,
    (
      SELECT count(*)
      FROM public.residents res
      WHERE res.organization_id = org.id
        AND res.archived_at IS NULL
    ) AS active_resident_count,
    (
      SELECT count(*)
      FROM auth.users u
      WHERE u.raw_app_meta_data->>'organization_id' = org.id::text
        AND u.raw_app_meta_data->>'role' IN ('org_admin', 'nurse')
    ) AS staff_count,
    (
      SELECT count(*)
      FROM auth.users u
      WHERE u.raw_app_meta_data->>'organization_id' = org.id::text
        AND u.raw_app_meta_data->>'role' = 'org_admin'
    ) AS administrator_count
  FROM public.organizations org
  ORDER BY org.created_at DESC;
END;
$function$;

-- 4. Dane: rola i placówka nie mieszkają w user_metadata -------------------------------------------------

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role' - 'organization_id'
WHERE raw_user_meta_data ?| ARRAY['role', 'organization_id'];
