-- Migration: 20261113090000_resident_death_report_staff_only.sql
-- @REQ: ADM-BED-ASSIGNMENT, @REQ: ADM-ARCHIVE, @REQ: ORG-ISOLATION
--
-- 1. Przeniesienie stanu oczekującego zgłoszenia zgonu poza tabelę residents do dedykowanej tabeli
--    personelu (resident_death_reports), aby rola family / legal_guardian nigdy nie odczytała stanu
--    zgłoszenia przed zatwierdzeniem przez Kierownika placówki (residents_family_select daje cały wiersz).
-- 2. Uszczelnienie polityki resident_events_insert przeciw zapisowi między placówkami.
-- 3. Atomowe funkcje RPC (report_resident_death_atomic i cancel_resident_death_report_atomic) w jednej
--    transakcji, z powiązaniem identyfikatorów zadań agendy (task_ids), aby anulowanie usuwało wyłącznie
--    zadania procedury po zgonie, a nie wszystkie zadania staff_only podopiecznego.

-- 1. Usunięcie kolumny death_reported_at z tabeli residents oraz dawnego triggera
DROP TRIGGER IF EXISTS trg_sync_resident_death_reported ON public.resident_events;
DROP FUNCTION IF EXISTS public.sync_resident_death_reported();

ALTER TABLE public.residents
  DROP COLUMN IF EXISTS death_reported_at;

-- 2. Rozszerzenie dozwolonych typów zdarzeń w resident_events o 'death_reported' i 'death_reported_cancelled'
ALTER TABLE public.resident_events
  DROP CONSTRAINT IF EXISTS resident_events_event_type_check;

ALTER TABLE public.resident_events
  ADD CONSTRAINT resident_events_event_type_check CHECK (event_type IN (
    'contract_signed',
    'contract_ended',
    'death',
    'death_reported',
    'death_reported_cancelled',
    'care_level_changed',
    'admission',
    'bed_transfer',
    'package_added',
    'package_removed'
  ));

-- 3. RLS resident_events: weryfikacja przynależności podopiecznego (resident_id) do placówki z JWT
DROP POLICY IF EXISTS "resident_events_insert" ON public.resident_events;
CREATE POLICY "resident_events_insert" ON public.resident_events
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = resident_events.resident_id
        AND r.organization_id = public.get_jwt_organization_id()
    )
    AND (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = ANY (ARRAY['org_admin', 'super_admin'])
      OR (
        COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'nurse'
        AND event_type = 'death_reported'
      )
    )
  );

-- 4. Ochrona widoczności zadań w planie dnia (agenda_items): zadania staff_only oraz internal nigdy nie są widoczne dla rodziny
CREATE OR REPLACE FUNCTION public.set_agenda_family_visible()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF lower(coalesce(NEW.type, '')) IN ('staff_only', 'internal') THEN
    NEW.family_visible := false;
  ELSE
    NEW.family_visible := NOT public.is_medical_agenda_item(NEW.title, NEW.type);
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Dedykowana tabela oczekujących zgłoszeń zgonu (wyłącznie dla personelu placówki, zero dostępu dla family/legal_guardian)
CREATE TABLE IF NOT EXISTS public.resident_death_reports (
  resident_id uuid PRIMARY KEY REFERENCES public.residents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reported_death_date date NOT NULL,
  notes text,
  task_ids uuid[] NOT NULL DEFAULT '{}',
  reported_at timestamptz NOT NULL DEFAULT now(),
  reported_by uuid NOT NULL
);

ALTER TABLE public.resident_death_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resident_death_reports_staff_select" ON public.resident_death_reports;
CREATE POLICY "resident_death_reports_staff_select" ON public.resident_death_reports
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_jwt_organization_id()
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') IN ('org_admin', 'nurse', 'super_admin')
  );

DROP POLICY IF EXISTS "resident_death_reports_staff_insert" ON public.resident_death_reports;
CREATE POLICY "resident_death_reports_staff_insert" ON public.resident_death_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_jwt_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = resident_death_reports.resident_id
        AND r.organization_id = public.get_jwt_organization_id()
        AND r.death_date IS NULL
    )
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') IN ('org_admin', 'nurse')
  );

DROP POLICY IF EXISTS "resident_death_reports_admin_delete" ON public.resident_death_reports;
CREATE POLICY "resident_death_reports_admin_delete" ON public.resident_death_reports
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_jwt_organization_id()
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') IN ('org_admin', 'super_admin')
  );

REVOKE ALL ON TABLE public.resident_death_reports FROM PUBLIC;
REVOKE ALL ON TABLE public.resident_death_reports FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.resident_death_reports TO authenticated;
GRANT ALL ON TABLE public.resident_death_reports TO service_role;

-- 6. Atomowe zgłoszenie zgonu przez personel w jednej transakcji (resident_death_reports + agenda_items + resident_events + audit_logs)
CREATE OR REPLACE FUNCTION public.report_resident_death_atomic(
  p_resident_id uuid,
  p_death_date date,
  p_notes text DEFAULT NULL,
  p_tasks jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '');
  v_jwt_org uuid := public.get_jwt_organization_id();
  v_res_org uuid;
  v_death_date date;
  v_has_bed boolean;
  v_task_ids uuid[];
BEGIN
  IF v_uid IS NULL OR v_role NOT IN ('nurse', 'org_admin') THEN
    RAISE EXCEPTION 'DEATH_REPORT_FORBIDDEN: brak uprawnień do operacyjnego zgłoszenia zgonu' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id, death_date
    INTO v_res_org, v_death_date
  FROM public.residents
  WHERE id = p_resident_id;

  IF NOT FOUND OR v_res_org IS DISTINCT FROM v_jwt_org THEN
    RAISE EXCEPTION 'DEATH_REPORT_NOT_FOUND: nie znaleziono podopiecznego w tej placówce' USING ERRCODE = 'P0002';
  END IF;

  IF v_death_date IS NOT NULL THEN
    RAISE EXCEPTION 'DEATH_ALREADY_CONFIRMED: dla tego podopiecznego zarejestrowano już fakt zgonu' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.resident_death_reports WHERE resident_id = p_resident_id) THEN
    RAISE EXCEPTION 'DEATH_ALREADY_REPORTED: dla tego podopiecznego zarejestrowano już zgłoszenie zgonu' USING ERRCODE = '23505';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.bed_assignments
    WHERE resident_id = p_resident_id AND unassigned_at IS NULL
  ) INTO v_has_bed;

  WITH inserted_tasks AS (
    INSERT INTO public.agenda_items (organization_id, resident_id, target_date, time, type, title, family_visible)
    SELECT
      v_res_org,
      p_resident_id,
      COALESCE((t->>'target_date')::date, p_death_date),
      COALESCE(t->>'time', '08:00')::time,
      'staff_only',
      t->>'title',
      false
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(p_tasks) = 'array' THEN p_tasks
        WHEN jsonb_typeof(p_tasks) = 'string' THEN (p_tasks #>> '{}')::jsonb
        ELSE '[]'::jsonb
      END
    ) AS t
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_task_ids FROM inserted_tasks;

  INSERT INTO public.resident_death_reports (
    resident_id,
    organization_id,
    reported_death_date,
    notes,
    task_ids,
    reported_by
  ) VALUES (
    p_resident_id,
    v_res_org,
    p_death_date,
    p_notes,
    v_task_ids,
    v_uid
  );

  INSERT INTO public.resident_events (
    organization_id,
    resident_id,
    event_type,
    event_date,
    event_reason,
    metadata,
    performed_by
  ) VALUES (
    v_res_org,
    p_resident_id,
    'death_reported',
    p_death_date,
    'death_reported',
    jsonb_build_object('death_date', p_death_date::text, 'notes', p_notes),
    v_uid
  );

  INSERT INTO public.audit_logs (
    organization_id,
    performed_by,
    action,
    payload
  ) VALUES (
    v_res_org,
    v_uid,
    'RESIDENT_DEATH_REPORTED',
    jsonb_build_object(
      'target_table', 'residents',
      'target_id', p_resident_id,
      'has_bed_assignment', v_has_bed,
      'sanitization_required', true
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.report_resident_death_atomic(uuid, date, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_resident_death_atomic(uuid, date, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_resident_death_atomic(uuid, date, text, jsonb) TO authenticated;

-- 7. Atomowe anulowanie omyłkowego zgłoszenia zgonu przez Kierownika placówki (usuwa tylko zadania powiązane ze zgłoszeniem)
CREATE OR REPLACE FUNCTION public.cancel_resident_death_report_atomic(
  p_resident_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '');
  v_jwt_org uuid := public.get_jwt_organization_id();
  v_org_id uuid;
  v_rep_date date;
  v_task_ids uuid[];
BEGIN
  IF v_uid IS NULL OR v_role NOT IN ('org_admin', 'super_admin') THEN
    RAISE EXCEPTION 'DEATH_CANCEL_FORBIDDEN: brak uprawnień do anulowania zgłoszenia zgonu' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id, reported_death_date, task_ids
    INTO v_org_id, v_rep_date, v_task_ids
  FROM public.resident_death_reports
  WHERE resident_id = p_resident_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEATH_REPORT_NOT_PENDING: ten podopieczny nie ma oczekującego zgłoszenia zgonu' USING ERRCODE = 'P0002';
  END IF;

  IF v_role <> 'super_admin' AND v_org_id IS DISTINCT FROM v_jwt_org THEN
    RAISE EXCEPTION 'DEATH_CANCEL_FORBIDDEN: brak uprawnień do zasobów innej placówki' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.resident_death_reports
  WHERE resident_id = p_resident_id;

  IF COALESCE(array_length(v_task_ids, 1), 0) > 0 THEN
    DELETE FROM public.agenda_items
    WHERE resident_id = p_resident_id
      AND id = ANY(v_task_ids);
  ELSE
    DELETE FROM public.agenda_items
    WHERE resident_id = p_resident_id
      AND target_date = v_rep_date
      AND type = 'staff_only'
      AND (
        title LIKE 'Procedura po zgonie:%'
        OR title LIKE 'Sanityzacja i dezynfekcja miejsca%'
      );
  END IF;

  INSERT INTO public.resident_events (
    organization_id,
    resident_id,
    event_type,
    event_date,
    event_reason,
    performed_by
  ) VALUES (
    v_org_id,
    p_resident_id,
    'death_reported_cancelled',
    CURRENT_DATE,
    'death_reported_cancelled',
    v_uid
  );

  INSERT INTO public.audit_logs (
    organization_id,
    performed_by,
    action,
    payload
  ) VALUES (
    v_org_id,
    v_uid,
    'RESIDENT_DEATH_REPORT_CANCELLED',
    jsonb_build_object(
      'target_table', 'residents',
      'target_id', p_resident_id
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_resident_death_report_atomic(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_resident_death_report_atomic(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_resident_death_report_atomic(uuid) TO authenticated;
