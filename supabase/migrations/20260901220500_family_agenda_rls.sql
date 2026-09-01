-- Migration: 20260901220500_family_agenda_rls.sql

-- Zastąpienie szerokiej polityki izolacji dwiema precyzyjniejszymi dla personelu i rodzin

DROP POLICY IF EXISTS "agenda_items_isolation" ON public.agenda_items;

-- Personel widzi wszystkie wydarzenia w swojej placówce
CREATE POLICY "agenda_items_staff_select" ON public.agenda_items
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse', 'super_admin')
  );

-- Rodzina widzi wydarzenia wspólne (resident_id IS NULL) oraz te przypisane do swoich podopiecznych
CREATE POLICY "agenda_items_family_select" ON public.agenda_items
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian') AND
    (
      resident_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.resident_relative_links
        WHERE resident_relative_links.resident_id = agenda_items.resident_id
        AND resident_relative_links.relative_user_id = auth.uid()
      )
    )
  );
