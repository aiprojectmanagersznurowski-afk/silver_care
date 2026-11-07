-- NUR-SHIFT-PLAN-PRINT (SC-NUR-16; ADR-021, decyzje Michała z 2026-10-30)
-- Wydruk planu pracy zmiany: drukuje kierownik zmiany albo kierownik placówki, wyłącznie zatwierdzony i aktualny plan
-- (SHIFT_TASK_POLICY.planApproval: requiredBeforePrint, reapprovalOnChange). Wydruk zostawia ślad w audycie
-- (SHIFT_PLAN_PRINTED: identyfikatory i wersja, bez treści zadań) oraz znacznik printed_at na akceptacji.
-- Tożsamość i placówka z sesji (auth.uid(), JWT) — nigdy z parametrów.
--
-- Wymaga: 20261030200000_shift_tasks_plan_approvals.sql.
-- Wycofanie: DROP FUNCTION public.record_shift_plan_print(uuid, date);

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

REVOKE ALL ON FUNCTION public.record_shift_plan_print(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_shift_plan_print(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_shift_plan_print(uuid, date) TO authenticated;
