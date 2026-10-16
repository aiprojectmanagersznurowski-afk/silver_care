-- Migration: 20261016160000_fix_legal_guardian_rls_policies.sql
-- HOTFIX: Pełna symetria uprawnień legal_guardian i family w politykach RLS dla family_messages i physiological_data_ingest
-- Zgodność z contracts/roles.contract.mjs (@REQ: FAM-MESSAGES, MDR-NO-PHYSIO-TO-FAMILY)

-- 1. Aktualizacja SELECT dla family_messages
-- Pielęgniarki i admini widzą wszystko w organizacji.
-- Członkowie rodziny i opiekunowie prawni (legal_guardian) widzą wiadomości powiązane z ich kontem.
DROP POLICY IF EXISTS "family_messages_select" ON public.family_messages;

CREATE POLICY "family_messages_select" ON public.family_messages
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse')
      OR
      (
        COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian') AND
        relative_user_id = auth.uid()
      )
    )
  );

-- 2. Aktualizacja INSERT dla family_messages
-- Zarówno family jak i legal_guardian mogą wysyłać wiadomości wyłącznie do podopiecznych,
-- z którymi posiadają aktywne powiązanie w resident_relative_links.
DROP POLICY IF EXISTS "family_messages_family_insert" ON public.family_messages;

CREATE POLICY "family_messages_family_insert" ON public.family_messages
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian') AND
    relative_user_id = auth.uid() AND
    is_from_family = true AND
    EXISTS (
      SELECT 1 FROM public.resident_relative_links rrl
      WHERE rrl.resident_id = family_messages.resident_id
        AND rrl.relative_user_id = auth.uid()
        AND rrl.role IN ('family', 'legal_guardian')
    )
  );

-- 3. Aktualizacja SELECT dla physiological_data_ingest (MDR-NO-PHYSIO-TO-FAMILY)
-- Blokada surowych danych fizjologicznych zarówno dla family, jak i legal_guardian
DROP POLICY IF EXISTS "ingest_isolation" ON public.physiological_data_ingest;

CREATE POLICY "ingest_isolation" ON public.physiological_data_ingest
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') NOT IN ('family', 'legal_guardian')
  );
