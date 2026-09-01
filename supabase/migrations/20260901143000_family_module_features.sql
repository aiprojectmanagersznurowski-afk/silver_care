-- 1. Agenda Items
CREATE TABLE IF NOT EXISTS public.agenda_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
    title text NOT NULL,
    time time NOT NULL,
    type text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_items_isolation" ON public.agenda_items
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id()
  );

CREATE POLICY "agenda_items_admin_insert" ON public.agenda_items
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse')
  );

CREATE POLICY "agenda_items_admin_update" ON public.agenda_items
  FOR UPDATE
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse')
  );

CREATE POLICY "agenda_items_admin_delete" ON public.agenda_items
  FOR DELETE
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('org_admin', 'nurse')
  );

-- 2. Family Messages
CREATE TABLE IF NOT EXISTS public.family_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    relative_user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.family_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_messages_isolation" ON public.family_messages
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id()
  );

CREATE POLICY "family_messages_family_insert" ON public.family_messages
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'family' AND
    relative_user_id = auth.uid()
  );

-- No UPDATE or DELETE policies for family_messages to ensure append-only/immutable nature.

