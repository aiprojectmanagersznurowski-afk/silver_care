-- NUR-TASKS, NUR-SHIFT-PLAN-PRINT (SC-NUR-13/15/16; ADR-021, decyzje Michała z 2026-10-30)
-- Zadania zmiany i akceptacje planu pracy. Zmiana to klucz (shift_definition_id, shift_date).
-- Kontrakt: roles.contract.mjs (MATRIX shift_tasks, shift_plan_approvals; SHIFT_LEAD_SCOPE),
--           facility.contract.mjs (SHIFT_TASK_POLICY).
-- Dostęp wyłącznie personelu. Rodzina i opiekun prawny nie mają dostępu.
-- Personel dodaje zadania ręczne jako propozycje; status zmienia kierownik zmiany (tylko na swojej zmianie i dniu)
-- albo kierownik placówki. Zadania są poleceniami personelu — system nie wyprowadza ich ze stanu zdrowia.
--
-- Wymaga: 20261030100000_shift_definitions_roster.sql (shift_definitions, shift_roster, is_shift_lead).
-- Wycofanie: DROP FUNCTION public.settle_shift_task(uuid, text, text, uuid, date);
--            DROP TABLE public.shift_plan_approvals, public.shift_tasks CASCADE;
--            DROP FUNCTION public.guard_shift_task(); DROP FUNCTION public.audit_shift_task_status();

-- 1. Zadania -----------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shift_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shift_definition_id uuid NOT NULL,
  shift_date date NOT NULL,
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL, -- NULL = zadanie placówki
  assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,   -- NULL = cała zmiana
  title text NOT NULL,
  due_time time,
  source text NOT NULL DEFAULT 'MANUAL',
  source_ref text,
  source_quote text,
  carried_from_task_id uuid REFERENCES public.shift_tasks(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PROPOSED',
  cancel_reason text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  settled_by uuid REFERENCES auth.users(id),
  settled_at timestamptz,
  plan_version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_shift_tasks_definition FOREIGN KEY (shift_definition_id, organization_id)
    REFERENCES public.shift_definitions(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT chk_shift_tasks_status CHECK (status IN ('PROPOSED', 'TODO', 'DONE', 'CANCELLED')),
  CONSTRAINT chk_shift_tasks_source CHECK (source IN ('MANUAL', 'HANDOVER', 'CARE_PLAN')),
  CONSTRAINT chk_shift_tasks_title CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  -- anulowanie zawsze z powodem (SHIFT_TASK_POLICY.cancelRequiresReason)
  CONSTRAINT chk_shift_tasks_cancel_reason CHECK (status <> 'CANCELLED' OR length(btrim(COALESCE(cancel_reason, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_shift_tasks_shift ON public.shift_tasks (shift_definition_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_tasks_resident ON public.shift_tasks (resident_id) WHERE status IN ('PROPOSED', 'TODO');

-- Strażnik: podopieczny z tej samej placówki, niezmienne klucze zadania, rozliczone zadanie jest zamknięte,
-- rozliczenie zapisuje, kto i kiedy (z sesji, nie z danych wejściowych).
CREATE OR REPLACE FUNCTION public.guard_shift_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.resident_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.residents r WHERE r.id = NEW.resident_id AND r.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'SHIFT_TASK_FOREIGN_RESIDENT: podopieczny spoza tej placówki' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id <> OLD.organization_id OR NEW.shift_definition_id <> OLD.shift_definition_id
       OR NEW.shift_date <> OLD.shift_date OR NEW.source <> OLD.source OR NEW.created_by <> OLD.created_by THEN
      RAISE EXCEPTION 'SHIFT_TASK_KEY_IMMUTABLE: zmiana, źródło i autor zadania są niezmienne' USING ERRCODE = '23514';
    END IF;
    IF OLD.status IN ('DONE', 'CANCELLED') AND NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'SHIFT_TASK_SETTLED: rozliczone zadanie jest zamknięte' USING ERRCODE = '23514';
    END IF;
    IF NEW.status IN ('DONE', 'CANCELLED') AND NEW.status <> OLD.status THEN
      NEW.settled_by := auth.uid();
      NEW.settled_at := now();
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS shift_tasks_guard ON public.shift_tasks;
CREATE TRIGGER shift_tasks_guard
  BEFORE INSERT OR UPDATE ON public.shift_tasks
  FOR EACH ROW EXECUTE FUNCTION public.guard_shift_task();

-- Audyt zmiany statusu: identyfikatory i statusy, bez treści zadania (RODO art. 9)
CREATE OR REPLACE FUNCTION public.audit_shift_task_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
    VALUES (NEW.organization_id, NEW.resident_id, 'SHIFT_TASK_STATUS_CHANGED', auth.uid(),
      jsonb_build_object('task_id', NEW.id, 'from', OLD.status, 'to', NEW.status,
        'shift_definition_id', NEW.shift_definition_id, 'shift_date', NEW.shift_date));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS shift_tasks_audit ON public.shift_tasks;
CREATE TRIGGER shift_tasks_audit
  AFTER UPDATE OF status ON public.shift_tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_shift_task_status();

-- 2. Akceptacje planu --------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shift_plan_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shift_definition_id uuid NOT NULL,
  shift_date date NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  printed_at timestamptz,
  CONSTRAINT fk_shift_plan_approvals_definition FOREIGN KEY (shift_definition_id, organization_id)
    REFERENCES public.shift_definitions(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT uq_shift_plan_approvals UNIQUE (shift_definition_id, shift_date, version)
);

-- 3. Rozliczenie zadania: trzy ścieżki (wykonane / anulowane z powodem / przeniesione) ----------------------
-- Tożsamość i placówka z sesji. Przeniesienie tworzy nowe zadanie; stare zostaje bez zmian (historia nie ginie).

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

REVOKE ALL ON FUNCTION public.settle_shift_task(uuid, text, text, uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_shift_task(uuid, text, text, uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.settle_shift_task(uuid, text, text, uuid, date) TO authenticated;

-- 4. RLS ---------------------------------------------------------------------------------------------------

ALTER TABLE public.shift_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_plan_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_tasks_staff_select" ON public.shift_tasks;
DROP POLICY IF EXISTS "shift_tasks_staff_insert" ON public.shift_tasks;
DROP POLICY IF EXISTS "shift_tasks_lead_update" ON public.shift_tasks;
DROP POLICY IF EXISTS "shift_plan_approvals_staff_select" ON public.shift_plan_approvals;
DROP POLICY IF EXISTS "shift_plan_approvals_lead_insert" ON public.shift_plan_approvals;

CREATE POLICY "shift_tasks_staff_select" ON public.shift_tasks
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse')
  );

-- Zwykły personel: wyłącznie ręczna propozycja z własnym autorstwem. Kierownik zmiany i kierownik placówki: dowolne.
CREATE POLICY "shift_tasks_staff_insert" ON public.shift_tasks
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id()
    AND created_by = auth.uid()
    AND (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
      OR (
        COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'nurse'
        AND (
          (source = 'MANUAL' AND status = 'PROPOSED')
          OR public.is_shift_lead(shift_definition_id, shift_date)
        )
      )
    )
  );

CREATE POLICY "shift_tasks_lead_update" ON public.shift_tasks
  FOR UPDATE
  USING (
    organization_id = public.get_jwt_organization_id() AND (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
      OR (
        COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'nurse'
        AND public.is_shift_lead(shift_definition_id, shift_date)
      )
    )
  )
  WITH CHECK (organization_id = public.get_jwt_organization_id());

CREATE POLICY "shift_plan_approvals_staff_select" ON public.shift_plan_approvals
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse')
  );

-- Akceptacje są dziennikiem: tylko dopisywanie (brak polityk UPDATE i DELETE)
CREATE POLICY "shift_plan_approvals_lead_insert" ON public.shift_plan_approvals
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id()
    AND approved_by = auth.uid()
    AND (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
      OR (
        COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'nurse'
        AND public.is_shift_lead(shift_definition_id, shift_date)
      )
    )
  );

DROP POLICY IF EXISTS "mfa_enforcement_shift_tasks" ON public.shift_tasks;
CREATE POLICY "mfa_enforcement_shift_tasks" ON public.shift_tasks
  AS RESTRICTIVE FOR ALL USING (public.check_mfa_requirement());
DROP POLICY IF EXISTS "mfa_enforcement_shift_plan_approvals" ON public.shift_plan_approvals;
CREATE POLICY "mfa_enforcement_shift_plan_approvals" ON public.shift_plan_approvals
  AS RESTRICTIVE FOR ALL USING (public.check_mfa_requirement());

COMMENT ON TABLE public.shift_tasks IS 'Zadania zmiany (polecenia personelu, nie ocena stanu zdrowia). Zmiana = (definicja, data). SC-NUR-13/15.';
COMMENT ON TABLE public.shift_plan_approvals IS 'Dziennik akceptacji planu pracy zmiany (wersje wydruku). Tylko dopisywanie. SC-NUR-16.';
