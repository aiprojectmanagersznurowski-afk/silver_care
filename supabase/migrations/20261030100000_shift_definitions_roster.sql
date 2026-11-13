-- NUR-SHIFT-CONFIG, NUR-SHIFT-LEAD (SC-NUR-12/AC1, AC1a; ADR-021, decyzje Michała z 2026-10-30)
-- Definicje zmian placówki (2–3 na dobę, Europe/Warsaw) i grafik z kierownikiem zmiany.
-- Zmiana to klucz (shift_definition_id, shift_date) — nie wiersz tworzony z wyprzedzeniem.
-- Kontrakt: roles.contract.mjs (MATRIX shift_definitions, shift_roster; SHIFT_LEAD_SCOPE),
--           facility.contract.mjs (SHIFT_POLICY).
-- Dostęp wyłącznie personelu: kierownik placówki konfiguruje i układa grafik, personel opiekuńczy czyta.
-- Rodzina i opiekun prawny nie mają dostępu. Super admin nie czyta tej konfiguracji (kontrakt).
--
-- Wycofanie: DROP TABLE public.shift_roster, public.shift_definitions CASCADE;
--            DROP FUNCTION public.is_shift_lead(uuid, date); DROP FUNCTION public.guard_shift_definitions_max();
--            DROP FUNCTION public.guard_shift_roster_user();

-- 1. Definicje zmian ---------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shift_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  -- zmiana nocna: koniec nie później niż początek oznacza przejście przez północ
  crosses_midnight boolean GENERATED ALWAYS AS (end_time <= start_time) STORED,
  order_index integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_definitions_code UNIQUE (organization_id, code),
  CONSTRAINT uq_shift_definitions_id_org UNIQUE (id, organization_id),
  CONSTRAINT chk_shift_definitions_times CHECK (start_time <> end_time)
);

-- Najwyżej 3 aktywne zmiany na placówkę (SHIFT_POLICY.shiftsPerDay.max). Dolną granicę (2) pilnuje ekran konfiguracji,
-- bo nowa placówka zaczyna od zera definicji.
CREATE OR REPLACE FUNCTION public.guard_shift_definitions_max()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_active integer;
BEGIN
  IF NEW.is_active THEN
    SELECT count(*) INTO v_active
    FROM public.shift_definitions d
    WHERE d.organization_id = NEW.organization_id AND d.is_active AND d.id <> NEW.id;
    IF v_active >= 3 THEN
      RAISE EXCEPTION 'SHIFT_DEFINITIONS_MAX_THREE: placówka ma najwyżej 3 aktywne zmiany na dobę'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS shift_definitions_max_three ON public.shift_definitions;
CREATE TRIGGER shift_definitions_max_three
  BEFORE INSERT OR UPDATE OF is_active ON public.shift_definitions
  FOR EACH ROW EXECUTE FUNCTION public.guard_shift_definitions_max();

-- 2. Grafik ------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shift_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shift_definition_id uuid NOT NULL,
  shift_date date NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_shift_lead boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_shift_roster_definition FOREIGN KEY (shift_definition_id, organization_id)
    REFERENCES public.shift_definitions(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT uq_shift_roster_user UNIQUE (shift_definition_id, shift_date, user_id)
);

-- Jeden kierownik na zmianę i dzień (SHIFT_LEAD_SCOPE.leadsPerShift = 1)
CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_roster_single_lead
  ON public.shift_roster (shift_definition_id, shift_date)
  WHERE is_shift_lead;

-- Osoba w grafiku musi być personelem tej placówki; kierownikiem zmiany może być tylko personel opiekuńczy (nurse).
-- Rola i placówka z app_metadata konta — nigdy z user_metadata.
CREATE OR REPLACE FUNCTION public.guard_shift_roster_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_org text;
BEGIN
  SELECT u.raw_app_meta_data->>'role', u.raw_app_meta_data->>'organization_id'
    INTO v_role, v_org
  FROM auth.users u WHERE u.id = NEW.user_id;

  IF v_org IS DISTINCT FROM NEW.organization_id::text OR v_role NOT IN ('nurse', 'org_admin') THEN
    RAISE EXCEPTION 'SHIFT_ROSTER_FOREIGN_USER: do grafiku można wpisać tylko personel tej placówki'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.is_shift_lead AND v_role <> 'nurse' THEN
    RAISE EXCEPTION 'SHIFT_LEAD_MUST_BE_NURSE: kierownikiem zmiany może być tylko personel opiekuńczy'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS shift_roster_user_guard ON public.shift_roster;
CREATE TRIGGER shift_roster_user_guard
  BEFORE INSERT OR UPDATE OF user_id, is_shift_lead ON public.shift_roster
  FOR EACH ROW EXECUTE FUNCTION public.guard_shift_roster_user();

-- 3. Kierownik zmiany: tożsamość wyłącznie z sesji (auth.uid()) i placówka z JWT — nigdy z parametrów ---------

CREATE OR REPLACE FUNCTION public.is_shift_lead(p_shift_definition_id uuid, p_shift_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.shift_roster r
    WHERE r.shift_definition_id = p_shift_definition_id
      AND r.shift_date = p_shift_date
      AND r.user_id = auth.uid()
      AND r.is_shift_lead
      AND r.organization_id = public.get_jwt_organization_id()
  );
$function$;

REVOKE ALL ON FUNCTION public.is_shift_lead(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_shift_lead(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_shift_lead(uuid, date) TO authenticated;

-- 4. RLS ---------------------------------------------------------------------------------------------------

ALTER TABLE public.shift_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_roster ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_definitions_staff_select" ON public.shift_definitions;
DROP POLICY IF EXISTS "shift_definitions_org_admin_insert" ON public.shift_definitions;
DROP POLICY IF EXISTS "shift_definitions_org_admin_update" ON public.shift_definitions;
DROP POLICY IF EXISTS "shift_roster_staff_select" ON public.shift_roster;
DROP POLICY IF EXISTS "shift_roster_org_admin_insert" ON public.shift_roster;
DROP POLICY IF EXISTS "shift_roster_org_admin_update" ON public.shift_roster;
DROP POLICY IF EXISTS "shift_roster_org_admin_delete" ON public.shift_roster;

CREATE POLICY "shift_definitions_staff_select" ON public.shift_definitions
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse')
  );

CREATE POLICY "shift_definitions_org_admin_insert" ON public.shift_definitions
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

CREATE POLICY "shift_definitions_org_admin_update" ON public.shift_definitions
  FOR UPDATE
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  )
  WITH CHECK (organization_id = public.get_jwt_organization_id());

CREATE POLICY "shift_roster_staff_select" ON public.shift_roster
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse')
  );

CREATE POLICY "shift_roster_org_admin_insert" ON public.shift_roster
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

CREATE POLICY "shift_roster_org_admin_update" ON public.shift_roster
  FOR UPDATE
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  )
  WITH CHECK (organization_id = public.get_jwt_organization_id());

CREATE POLICY "shift_roster_org_admin_delete" ON public.shift_roster
  FOR DELETE
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

-- Personel i kierownik placówki wymagają MFA (aal2), jak pozostałe tabele z danymi placówki
DROP POLICY IF EXISTS "mfa_enforcement_shift_definitions" ON public.shift_definitions;
CREATE POLICY "mfa_enforcement_shift_definitions" ON public.shift_definitions
  AS RESTRICTIVE FOR ALL USING (public.check_mfa_requirement());
DROP POLICY IF EXISTS "mfa_enforcement_shift_roster" ON public.shift_roster;
CREATE POLICY "mfa_enforcement_shift_roster" ON public.shift_roster
  AS RESTRICTIVE FOR ALL USING (public.check_mfa_requirement());

COMMENT ON TABLE public.shift_definitions IS 'Definicje zmian placówki (2–3 na dobę, Europe/Warsaw). SC-NUR-12/AC1.';
COMMENT ON TABLE public.shift_roster IS 'Grafik: kto pracuje na zmianie (definicja + data) i kto ją prowadzi. SC-NUR-12/AC1a.';
