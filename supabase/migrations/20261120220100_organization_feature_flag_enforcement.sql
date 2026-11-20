-- @REQ: SUP-FEATURE-FLAGS
-- Restrictive policies preserve the existing role, tenant and retention checks.
CREATE POLICY feature_daily_reports ON public.daily_reports AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_resident_org_feature(resident_id,
    CASE WHEN (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('family', 'legal_guardian')
      THEN 'module_family_portal' ELSE 'module_voice_and_reports' END));

CREATE POLICY feature_resident_media ON public.resident_media AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') NOT IN ('family', 'legal_guardian')
    OR public.has_resident_org_feature(resident_id, 'module_family_portal'));

CREATE POLICY feature_resident_media_storage ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'resident-media'
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') NOT IN ('family', 'legal_guardian')
    OR EXISTS (SELECT 1 FROM public.resident_media media WHERE media.storage_path = name));

CREATE POLICY feature_agenda_family ON public.agenda_items AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') NOT IN ('family', 'legal_guardian')
    OR public.has_org_feature(organization_id, 'module_family_portal'));

CREATE POLICY feature_family_messages ON public.family_messages AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_org_feature(organization_id, 'module_family_portal'));

CREATE POLICY feature_resident_invitations ON public.resident_invitations AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_org_feature(organization_id, 'module_family_portal'));

CREATE POLICY feature_voice_draft_notes ON public.voice_draft_notes AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_resident_org_feature(resident_id, 'module_voice_and_reports'));

CREATE POLICY feature_daily_logs ON public.daily_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_resident_org_feature(resident_id, 'module_voice_and_reports'));

CREATE POLICY feature_voice_devices ON public.voice_devices AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_org_feature(organization_id, 'module_voice_and_reports'));

CREATE POLICY feature_voice_device_assignments ON public.voice_device_assignments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_org_feature(organization_id, 'module_voice_and_reports'));

CREATE POLICY feature_shift_definitions ON public.shift_definitions AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_org_feature(organization_id, 'module_shift_tasks'));

CREATE POLICY feature_shift_roster ON public.shift_roster AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_org_feature(organization_id, 'module_shift_tasks'));

CREATE POLICY feature_shift_tasks ON public.shift_tasks AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_org_feature(organization_id, 'module_shift_tasks'));

CREATE POLICY feature_shift_plan_approvals ON public.shift_plan_approvals AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_org_feature(organization_id, 'module_shift_tasks'));

CREATE POLICY feature_external_wearable_links ON public.external_wearable_links AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_org_feature(organization_id, 'module_wearables_iot'));

CREATE OR REPLACE FUNCTION public.is_relative_active_or_retained(target_resident_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resident_relative_links rrl
    JOIN public.residents r ON r.id = rrl.resident_id
    WHERE rrl.resident_id = target_resident_id
      AND rrl.relative_user_id = auth.uid()
      AND public.has_org_feature(r.organization_id, 'module_family_portal')
      AND r.archived_at IS NULL
      AND (
        (r.death_date IS NULL AND r.contract_end_date IS NULL)
        -- roles.contract.mjs: OFFBOARDING_RETENTION_DAYS
        OR (COALESCE(r.death_date, r.contract_end_date) + interval '30 days')::date
          > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Warsaw')::date
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.family_has_active_link_in_org()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resident_relative_links rrl
    JOIN public.residents r ON r.id = rrl.resident_id
    WHERE rrl.relative_user_id = auth.uid()
      AND r.organization_id = public.get_jwt_organization_id()
      AND public.is_relative_active_or_retained(r.id)
  )
$$;

CREATE OR REPLACE FUNCTION public.get_family_resident_overview()
RETURNS TABLE (
  id uuid, first_name text, last_name text, photo_path text,
  death_date date, contract_end_date date, archived_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT r.id, r.first_name, r.last_name, r.photo_path, r.death_date, r.contract_end_date, r.archived_at
  FROM public.resident_relative_links rrl
  JOIN public.residents r ON r.id = rrl.resident_id
  WHERE rrl.relative_user_id = auth.uid()
    AND r.organization_id = public.get_jwt_organization_id()
    AND public.has_org_feature(r.organization_id, 'module_family_portal')
$$;

CREATE OR REPLACE FUNCTION public.notify_on_report_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF NEW.status = 'PUBLISHED' AND OLD.status <> 'PUBLISHED' THEN
    SELECT organization_id INTO v_org_id FROM public.residents WHERE id = NEW.resident_id;
    IF v_org_id IS NOT NULL AND private.feature_enabled(v_org_id, 'module_family_portal') THEN
      INSERT INTO public.outbox_notifications (organization_id, entity_type, entity_id, payload)
      VALUES (v_org_id, 'report', NEW.id, '{"message": "New report is ready"}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END
$$;

-- process_voice_draft_atomic uses SECURITY INVOKER. The policies on the draft,
-- logs and reports enforce the flag in the same transaction.

CREATE OR REPLACE FUNCTION public.settle_shift_task(
  p_task_id uuid, p_path text, p_reason text, p_target_definition_id uuid, p_target_date date
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := public.get_jwt_organization_id();
  v_role text := COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '');
  v_task public.shift_tasks%ROWTYPE;
  v_new uuid;
BEGIN
  IF v_org IS NOT NULL AND NOT public.has_org_feature(v_org, 'module_shift_tasks') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_task FROM public.shift_tasks WHERE id = p_task_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIFT_TASK_NOT_FOUND: nie znaleziono zadania' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_role = 'org_admin' OR (v_role = 'nurse' AND public.is_shift_lead(v_task.shift_definition_id, v_task.shift_date))) THEN
    RAISE EXCEPTION 'SHIFT_NOT_LEAD: zadania rozlicza kierownik zmiany albo kierownik placówki' USING ERRCODE = '42501';
  END IF;

  IF p_path = 'DONE' THEN
    UPDATE public.shift_tasks SET status = 'DONE' WHERE id = p_task_id;
    RETURN p_task_id;
  ELSIF p_path = 'CANCELLED' THEN
    IF length(btrim(COALESCE(p_reason, ''))) = 0 THEN
      RAISE EXCEPTION 'SHIFT_CANCEL_REASON_REQUIRED: anulowanie wymaga powodu' USING ERRCODE = '23514';
    END IF;
    UPDATE public.shift_tasks SET status = 'CANCELLED', cancel_reason = btrim(p_reason) WHERE id = p_task_id;
    RETURN p_task_id;
  ELSIF p_path = 'CARRIED' THEN
    IF p_target_definition_id IS NULL OR p_target_date IS NULL
       OR (p_target_definition_id = v_task.shift_definition_id AND p_target_date = v_task.shift_date) THEN
      RAISE EXCEPTION 'SHIFT_CARRY_TARGET_INVALID: podaj inną zmianę docelową' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.shift_definitions d WHERE d.id = p_target_definition_id AND d.organization_id = v_org) THEN
      RAISE EXCEPTION 'SHIFT_CARRY_TARGET_INVALID: zmiana docelowa spoza placówki' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.shift_tasks (organization_id, shift_definition_id, shift_date, resident_id, title, due_time,
                                    source, source_ref, source_quote, carried_from_task_id, status, created_by)
    VALUES (v_org, p_target_definition_id, p_target_date, v_task.resident_id, v_task.title, v_task.due_time,
            v_task.source, v_task.source_ref, v_task.source_quote, v_task.id, 'TODO', auth.uid())
    RETURNING id INTO v_new;
    RETURN v_new;
  END IF;
  RAISE EXCEPTION 'SHIFT_SETTLE_PATH_INVALID: nieznana ścieżka rozliczenia' USING ERRCODE = '22023';
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_shift_plan_print(p_shift_definition_id uuid, p_shift_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := public.get_jwt_organization_id();
  v_role text := COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '');
  v_approval public.shift_plan_approvals%ROWTYPE;
BEGIN
  IF v_org IS NOT NULL AND NOT public.has_org_feature(v_org, 'module_shift_tasks') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shift_definitions d WHERE d.id = p_shift_definition_id AND d.organization_id = v_org) THEN
    RAISE EXCEPTION 'SHIFT_NOT_FOUND: nie znaleziono zmiany' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_role = 'org_admin' OR (v_role = 'nurse' AND public.is_shift_lead(p_shift_definition_id, p_shift_date))) THEN
    RAISE EXCEPTION 'SHIFT_NOT_LEAD: plan drukuje kierownik zmiany albo kierownik placówki' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_approval FROM public.shift_plan_approvals a
  WHERE a.organization_id = v_org AND a.shift_definition_id = p_shift_definition_id AND a.shift_date = p_shift_date
  ORDER BY a.version DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIFT_PLAN_NOT_APPROVED: plan zmiany nie został zatwierdzony' USING ERRCODE = '23514';
  END IF;

  -- Zmiana zadań po akceptacji (propozycje nie wchodzą do planu) wymaga ponownej akceptacji
  IF EXISTS (
    SELECT 1 FROM public.shift_tasks t
    WHERE t.organization_id = v_org AND t.shift_definition_id = p_shift_definition_id AND t.shift_date = p_shift_date
      AND t.status <> 'PROPOSED' AND GREATEST(t.created_at, t.updated_at) > v_approval.approved_at
  ) THEN
    RAISE EXCEPTION 'SHIFT_PLAN_STALE: zadania zmieniły się po akceptacji planu' USING ERRCODE = '23514';
  END IF;

  UPDATE public.shift_plan_approvals SET printed_at = now() WHERE id = v_approval.id;
  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (v_org, 'SHIFT_PLAN_PRINTED', auth.uid(),
    jsonb_build_object('shift_definition_id', p_shift_definition_id, 'shift_date', p_shift_date, 'version', v_approval.version));
  RETURN v_approval.version;
END;
$function$;
