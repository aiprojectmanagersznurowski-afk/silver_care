-- Migration: 20261024120000_rls_role_isolation_residents_facility.sql
-- @REQ: ORG-ISOLATION
--
-- Izolacja wg roli w obrębie placówki. Dotychczasowe polityki SELECT sprawdzały wyłącznie organization_id,
-- więc konto rodziny / opiekuna prawnego z tokenem placówki mogło odczytać wszystkich jej podopiecznych,
-- łóżka, przypisania i cudze powiązania rodzin, a polityka ALL na rooms pozwalała każdej roli zmieniać pokoje.
-- Kontrakt (roles.contract.mjs): residents read = org_admin:own, nurse:own, legal_guardian:own, family:own;
-- rooms/beds read = org_admin:own, nurse:own; rooms create = org_admin;
-- resident_relative_links read = org_admin:own, legal_guardian:own (pielęgniarka bez dostępu);
-- resident_events i resident_packages read = org_admin:own (zdarzenia pobytu, w tym zgon, i opłaty).
--
-- Wycofanie (osobną migracją): odtworzyć polityki sprzed zmiany:
--   residents_isolation       FOR SELECT USING (organization_id = public.get_jwt_organization_id())
--   beds_isolation            FOR SELECT USING (EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = beds.room_id AND rooms.organization_id = public.get_jwt_organization_id()))
--   bed_assignments_isolation FOR SELECT USING (EXISTS (SELECT 1 FROM public.residents WHERE residents.id = bed_assignments.resident_id AND residents.organization_id = public.get_jwt_organization_id()))
--   links_isolation           FOR SELECT USING (EXISTS (SELECT 1 FROM public.residents WHERE residents.id = resident_relative_links.resident_id AND residents.organization_id = public.get_jwt_organization_id()))
--   "Isolated access for rooms" FOR ALL USING (organization_id = public.get_jwt_organization_id())
--   resident_events_isolation, resident_packages_isolation FOR SELECT USING (organization_id = public.get_jwt_organization_id())
-- i usunąć polityki dodane poniżej.

-- Personel placówki: role z kontraktu. Rodzina i opiekun prawny: przez is_relative_linked (SECURITY DEFINER,
-- bez rekurencji polityk między residents i resident_relative_links).

-- 1. residents
DROP POLICY IF EXISTS "residents_isolation" ON public.residents;
DROP POLICY IF EXISTS "residents_staff_select" ON public.residents;
DROP POLICY IF EXISTS "residents_family_select" ON public.residents;

CREATE POLICY "residents_staff_select" ON public.residents
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse', 'super_admin')
  );

CREATE POLICY "residents_family_select" ON public.residents
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian') AND
    public.is_relative_linked(id)
  );

-- 2. rooms: odczyt dla personelu, dodawanie tylko org_admin (update dla org_admin już istnieje)
DROP POLICY IF EXISTS "Isolated access for rooms" ON public.rooms;
DROP POLICY IF EXISTS "rooms_staff_select" ON public.rooms;
DROP POLICY IF EXISTS "rooms_org_admin_insert" ON public.rooms;

CREATE POLICY "rooms_staff_select" ON public.rooms
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse', 'super_admin')
  );

CREATE POLICY "rooms_org_admin_insert" ON public.rooms
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

-- 3. beds
DROP POLICY IF EXISTS "beds_isolation" ON public.beds;
DROP POLICY IF EXISTS "beds_staff_select" ON public.beds;

CREATE POLICY "beds_staff_select" ON public.beds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = beds.room_id
      AND rooms.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse', 'super_admin')
  );

-- 4. bed_assignments
DROP POLICY IF EXISTS "bed_assignments_isolation" ON public.bed_assignments;
DROP POLICY IF EXISTS "bed_assignments_staff_select" ON public.bed_assignments;

CREATE POLICY "bed_assignments_staff_select" ON public.bed_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.residents
      WHERE residents.id = bed_assignments.resident_id
      AND residents.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse', 'super_admin')
  );

-- 5. resident_relative_links: kierownik (i superadmin) widzi powiązania swojej placówki, rodzina tylko własne.
--    Pielęgniarka nie: kontrakt daje odczyt resident_relative_links tylko org_admin i legal_guardian.
DROP POLICY IF EXISTS "links_isolation" ON public.resident_relative_links;
DROP POLICY IF EXISTS "links_staff_select" ON public.resident_relative_links;
DROP POLICY IF EXISTS "links_own_select" ON public.resident_relative_links;

CREATE POLICY "links_staff_select" ON public.resident_relative_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.residents
      WHERE residents.id = resident_relative_links.resident_id
      AND residents.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'super_admin')
  );

CREATE POLICY "links_own_select" ON public.resident_relative_links
  FOR SELECT
  USING (
    relative_user_id = auth.uid() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian')
  );

-- 6. resident_events (wypis, zgon, zakończenie umowy) i resident_packages (opłaty): odczyt tylko kierownik
--    i superadmin. Wstawianie zdarzeń idzie kluczem serwisowym w akcji wypisu, więc tego nie zmienia.
DROP POLICY IF EXISTS "resident_events_isolation" ON public.resident_events;
DROP POLICY IF EXISTS "resident_events_manager_select" ON public.resident_events;

CREATE POLICY "resident_events_manager_select" ON public.resident_events
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'super_admin')
  );

DROP POLICY IF EXISTS "resident_packages_isolation" ON public.resident_packages;
DROP POLICY IF EXISTS "resident_packages_manager_select" ON public.resident_packages;

CREATE POLICY "resident_packages_manager_select" ON public.resident_packages
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'super_admin')
  );
