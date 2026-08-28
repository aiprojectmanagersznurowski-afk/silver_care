-- Migration: 20260828224800_residents.sql

-- 1. Create residents table
CREATE TABLE IF NOT EXISTS public.residents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL DEFAULT public.get_jwt_organization_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    pesel_hash text,
    created_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
);
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "residents_isolation" ON public.residents
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id()
  );

CREATE POLICY "residents_org_admin_insert" ON public.residents
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

CREATE POLICY "residents_org_admin_update" ON public.residents
  FOR UPDATE
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

-- 2. Create resident_relative_links table
CREATE TABLE IF NOT EXISTS public.resident_relative_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    relative_user_id uuid NOT NULL, 
    relationship_code text NOT NULL,
    role text NOT NULL CHECK (role IN ('family', 'legal_guardian')),
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.resident_relative_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "links_isolation" ON public.resident_relative_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.residents 
      WHERE residents.id = resident_relative_links.resident_id 
      AND residents.organization_id = public.get_jwt_organization_id()
    )
  );

CREATE POLICY "links_org_admin_insert" ON public.resident_relative_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.residents 
      WHERE residents.id = resident_id 
      AND residents.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

CREATE POLICY "links_org_admin_update" ON public.resident_relative_links
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.residents 
      WHERE residents.id = resident_id 
      AND residents.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

-- 3. Create beds table
CREATE TABLE IF NOT EXISTS public.beds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    label text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beds_isolation" ON public.beds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = beds.room_id
      AND rooms.organization_id = public.get_jwt_organization_id()
    )
  );

CREATE POLICY "beds_org_admin_insert" ON public.beds
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = room_id
      AND rooms.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

-- 4. Create bed_assignments table
CREATE TABLE IF NOT EXISTS public.bed_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bed_id uuid NOT NULL REFERENCES public.beds(id) ON DELETE CASCADE,
    resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    unassigned_at timestamptz
);

-- Próba przypisania zajętego łóżka jest odrzucana
CREATE UNIQUE INDEX active_bed_assignment_idx ON public.bed_assignments (bed_id) WHERE unassigned_at IS NULL;

ALTER TABLE public.bed_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bed_assignments_isolation" ON public.bed_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.residents
      WHERE residents.id = bed_assignments.resident_id
      AND residents.organization_id = public.get_jwt_organization_id()
    )
  );

CREATE POLICY "bed_assignments_org_admin_insert" ON public.bed_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.residents
      WHERE residents.id = resident_id
      AND residents.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );
