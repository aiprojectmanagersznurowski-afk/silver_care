-- VOICE-DEVICE-REGISTRY (SC-ADM-24; ADR-022 pkt 4, decyzje Michała z 2026-11-17)
-- Rejestr urządzeń nagrywających placówki i stałe przypisanie urządzenia do pracownika.
-- Kontrakt: roles.contract.mjs (MATRIX voice_devices, voice_device_assignments; SHIFT_LEAD_SCOPE),
--           integration.contract.mjs (DEVICE_AUTH: token tylko jako skrót, unieważnienie przez revoked_at).
-- Rejestruje i unieważnia kierownik placówki. Przypisuje kierownik placówki albo kierownik zmiany, która trwa
-- teraz (przypisanie jest stałe, więc nie ma klucza zmiany). Personel czyta. Bliscy, super admin i inne
-- placówki nie mają dostępu. Nic nie jest usuwane: urządzenie ma revoked_at, przydział ended_at.
--
-- Wycofanie: DROP TABLE public.voice_device_assignments, public.voice_devices CASCADE;
--            DROP FUNCTION public.is_shift_lead_now(); DROP FUNCTION public.guard_voice_device_assignment();

-- 1. Urządzenia --------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voice_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  -- SHA-256 tokenu (hex). Jawny token pokazywany jest raz przy rejestracji i nigdzie nie jest zapisywany.
  token_hash text NOT NULL,
  firmware_version text,
  last_sync_at timestamptz,
  revoked_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_voice_devices_label UNIQUE (organization_id, label),
  CONSTRAINT uq_voice_devices_token_hash UNIQUE (token_hash),
  CONSTRAINT uq_voice_devices_id_org UNIQUE (id, organization_id),
  CONSTRAINT chk_voice_devices_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

-- 2. Stałe przypisanie do pracownika ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voice_device_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  device_id uuid NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  -- Zamyka wyłącznie zwrot urządzenia, nie koniec zmiany (SC-ADM-24/AC4).
  ended_at timestamptz,
  assigned_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_voice_device_assignments_device FOREIGN KEY (device_id, organization_id)
    REFERENCES public.voice_devices (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT chk_voice_device_assignments_period CHECK (ended_at IS NULL OR ended_at > started_at)
);

-- Najwyżej jeden aktywny przydział na urządzenie.
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_device_assignments_active
  ON public.voice_device_assignments (device_id) WHERE ended_at IS NULL;
-- Autor nagrania z przydziału w chwili recorded_at (DEVICE_INGEST_PROTOCOL.authorship).
CREATE INDEX IF NOT EXISTS idx_voice_device_assignments_device_period
  ON public.voice_device_assignments (device_id, started_at);
CREATE INDEX IF NOT EXISTS idx_voice_device_assignments_user
  ON public.voice_device_assignments (user_id);

-- Przydział: urządzenie z tej placówki i nieunieważnione, osoba z personelu tej placówki,
-- przedziały bez nakładania się (aktywne nawzajem pilnuje indeks uq_voice_device_assignments_active).
CREATE OR REPLACE FUNCTION public.guard_voice_device_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_device_org uuid;
  v_revoked timestamptz;
  v_role text;
  v_user_org text;
BEGIN
  SELECT d.organization_id, d.revoked_at INTO v_device_org, v_revoked
  FROM public.voice_devices d WHERE d.id = NEW.device_id;

  IF v_device_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'VOICE_DEVICE_ORG_MISMATCH: urządzenie należy do innej placówki' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND v_revoked IS NOT NULL THEN
    RAISE EXCEPTION 'VOICE_DEVICE_REVOKED: urządzenie jest unieważnione' USING ERRCODE = '23514';
  END IF;

  SELECT u.raw_app_meta_data->>'role', u.raw_app_meta_data->>'organization_id'
    INTO v_role, v_user_org
  FROM auth.users u WHERE u.id = NEW.user_id;
  IF v_user_org IS DISTINCT FROM NEW.organization_id::text OR v_role NOT IN ('nurse', 'org_admin') THEN
    RAISE EXCEPTION 'VOICE_DEVICE_ASSIGNEE_FOREIGN: urządzenie można przypisać tylko personelowi tej placówki'
      USING ERRCODE = '23514';
  END IF;

  -- Odwrócony przedział odrzuca chk_voice_device_assignments_period; zakresu z takimi granicami nie da się zbudować.
  IF (NEW.ended_at IS NULL OR NEW.ended_at > NEW.started_at) AND EXISTS (
    SELECT 1 FROM public.voice_device_assignments o
    WHERE o.device_id = NEW.device_id
      AND o.id <> NEW.id
      AND (o.ended_at IS NOT NULL OR NEW.ended_at IS NOT NULL)
      AND tstzrange(o.started_at, COALESCE(o.ended_at, 'infinity'::timestamptz))
          && tstzrange(NEW.started_at, COALESCE(NEW.ended_at, 'infinity'::timestamptz))
  ) THEN
    RAISE EXCEPTION 'VOICE_DEVICE_ASSIGNMENT_OVERLAP: przydział nakłada się na inny przydział tego urządzenia'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS voice_device_assignment_guard ON public.voice_device_assignments;
CREATE TRIGGER voice_device_assignment_guard
  BEFORE INSERT OR UPDATE OF device_id, user_id, organization_id, started_at, ended_at
  ON public.voice_device_assignments
  FOR EACH ROW EXECUTE FUNCTION public.guard_voice_device_assignment();

-- 3. Kierownik trwającej zmiany: tożsamość z sesji, placówka z JWT, czas zmiany w Europe/Warsaw ----------

CREATE OR REPLACE FUNCTION public.is_shift_lead_now()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.shift_roster r
    JOIN public.shift_definitions d ON d.id = r.shift_definition_id
    WHERE r.user_id = auth.uid()
      AND r.is_shift_lead
      AND d.is_active
      AND r.organization_id = public.get_jwt_organization_id()
      AND now() >= (r.shift_date + d.start_time) AT TIME ZONE 'Europe/Warsaw'
      AND now() < ((r.shift_date + CASE WHEN d.crosses_midnight THEN 1 ELSE 0 END) + d.end_time) AT TIME ZONE 'Europe/Warsaw'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_shift_lead_now() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_shift_lead_now() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_shift_lead_now() TO authenticated;

-- 4. RLS ---------------------------------------------------------------------------------------------------

ALTER TABLE public.voice_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_device_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice_devices_staff_select" ON public.voice_devices;
DROP POLICY IF EXISTS "voice_devices_org_admin_insert" ON public.voice_devices;
DROP POLICY IF EXISTS "voice_devices_org_admin_update" ON public.voice_devices;
DROP POLICY IF EXISTS "voice_device_assignments_staff_select" ON public.voice_device_assignments;
DROP POLICY IF EXISTS "voice_device_assignments_manager_insert" ON public.voice_device_assignments;
DROP POLICY IF EXISTS "voice_device_assignments_manager_update" ON public.voice_device_assignments;

CREATE POLICY "voice_devices_staff_select" ON public.voice_devices
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse')
  );

CREATE POLICY "voice_devices_org_admin_insert" ON public.voice_devices
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

CREATE POLICY "voice_devices_org_admin_update" ON public.voice_devices
  FOR UPDATE
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  )
  WITH CHECK (organization_id = public.get_jwt_organization_id());

CREATE POLICY "voice_device_assignments_staff_select" ON public.voice_device_assignments
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse')
  );

CREATE POLICY "voice_device_assignments_manager_insert" ON public.voice_device_assignments
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin' OR
      (COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'nurse' AND public.is_shift_lead_now())
    )
  );

CREATE POLICY "voice_device_assignments_manager_update" ON public.voice_device_assignments
  FOR UPDATE
  USING (
    organization_id = public.get_jwt_organization_id() AND (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin' OR
      (COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'nurse' AND public.is_shift_lead_now())
    )
  )
  WITH CHECK (organization_id = public.get_jwt_organization_id());

-- Personel i kierownik placówki wymagają MFA (aal2), jak pozostałe tabele z danymi placówki
DROP POLICY IF EXISTS "mfa_enforcement_voice_devices" ON public.voice_devices;
CREATE POLICY "mfa_enforcement_voice_devices" ON public.voice_devices
  AS RESTRICTIVE FOR ALL USING (public.check_mfa_requirement());
DROP POLICY IF EXISTS "mfa_enforcement_voice_device_assignments" ON public.voice_device_assignments;
CREATE POLICY "mfa_enforcement_voice_device_assignments" ON public.voice_device_assignments
  AS RESTRICTIVE FOR ALL USING (public.check_mfa_requirement());

COMMENT ON TABLE public.voice_devices IS 'Urządzenia nagrywające placówki (StickS3). Token tylko jako skrót, unieważnienie przez revoked_at. SC-ADM-24.';
COMMENT ON TABLE public.voice_device_assignments IS 'Stałe przypisanie urządzenia do pracownika; zamyka je zwrot (ended_at). SC-ADM-24.';
