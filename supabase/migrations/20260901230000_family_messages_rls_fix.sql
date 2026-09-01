-- Drop the old overly permissive insert policy
DROP POLICY IF EXISTS "family_messages_family_insert" ON public.family_messages;

-- Create the new, strict policy checking resident_relative_links
CREATE POLICY "family_messages_family_insert" ON public.family_messages
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'family' AND
    relative_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.resident_relative_links rrl
      WHERE rrl.resident_id = family_messages.resident_id
        AND rrl.relative_user_id = auth.uid()
        AND rrl.role = 'family'
    )
  );

-- Admin read policy
CREATE POLICY "family_messages_admin_select" ON public.family_messages
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );
