-- Dodanie nowych kolumn do tabeli family_messages bez utraty danych

ALTER TABLE public.family_messages
ADD COLUMN IF NOT EXISTS is_from_family boolean NOT NULL DEFAULT true;

ALTER TABLE public.family_messages
ADD COLUMN IF NOT EXISTS staff_user_id uuid REFERENCES auth.users(id);

-- Stara polisa dla select zakładała tylko organizację. Zmieniamy ją na bezpieczniejszą:

DROP POLICY IF EXISTS "family_messages_isolation" ON public.family_messages;

CREATE POLICY "family_messages_select" ON public.family_messages
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    (
      -- Admini i Pielęgniarki z tej organizacji mogą widzieć wszystko w tej organizacji
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse')
      OR
      -- Rodzina widzi tylko to, gdzie relative_user_id = auth.uid()
      (
        COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'family' AND
        relative_user_id = auth.uid()
      )
    )
  );

-- Zaktualizowanie wstawiania dla Rodziny (tylko jako is_from_family = true)
DROP POLICY IF EXISTS "family_messages_family_insert" ON public.family_messages;

CREATE POLICY "family_messages_family_insert" ON public.family_messages
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'family' AND
    relative_user_id = auth.uid() AND
    is_from_family = true
  );

-- Dodanie wstawiania dla Personelu
CREATE POLICY "family_messages_staff_insert" ON public.family_messages
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse') AND
    is_from_family = false AND
    staff_user_id = auth.uid()
  );
