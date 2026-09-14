-- Migration: 20260914170000_rls_hardening.sql
-- REQ: ORG-ISOLATION — Hardening RLS policies, full CRUD on organizations for super_admin, multi-tenant isolation

-- 1. Tabela organizations — pełny CRUD
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Isolated access for organizations" ON public.organizations;
DROP POLICY IF EXISTS "organizations_isolation" ON public.organizations;
DROP POLICY IF EXISTS "organizations_super_admin_insert" ON public.organizations;
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;

-- SELECT: super_admin widzi wszystkie placówki; personel i rodzina widzą wyłącznie własną placówkę
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'super_admin'
    OR id = public.get_jwt_organization_id()
  );

-- INSERT: wyłącznie super_admin
CREATE POLICY "organizations_insert" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'super_admin'
  );

-- UPDATE: super_admin (dowolna placówka) oraz org_admin (wyłącznie własna placówka)
CREATE POLICY "organizations_update" ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'super_admin'
    OR (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
      AND id = public.get_jwt_organization_id()
    )
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'super_admin'
    OR (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
      AND id = public.get_jwt_organization_id()
    )
  );

-- DELETE: wyłącznie super_admin
CREATE POLICY "organizations_delete" ON public.organizations
  FOR DELETE TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'super_admin'
  );
