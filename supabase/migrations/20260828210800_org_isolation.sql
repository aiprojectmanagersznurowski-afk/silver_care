-- Migration: 20260828210800_org_isolation.sql

-- 1. Create a function to extract organization_id from JWT
CREATE OR REPLACE FUNCTION public.get_jwt_organization_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::jsonb->'app_metadata'->>'organization_id',
    ''
  )::uuid;
$$;

-- 2. Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolated access for organizations"
    ON public.organizations
    FOR ALL
    TO authenticated
    USING (id = public.get_jwt_organization_id());

-- 4. Create rooms table to test inheritance of organization_id
CREATE TABLE IF NOT EXISTS public.rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    organization_id uuid NOT NULL DEFAULT public.get_jwt_organization_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Enable RLS on rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolated access for rooms"
    ON public.rooms
    FOR ALL
    TO authenticated
    USING (organization_id = public.get_jwt_organization_id());
