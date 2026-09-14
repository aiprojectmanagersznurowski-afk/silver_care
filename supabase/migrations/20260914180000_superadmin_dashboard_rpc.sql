-- Migration: 20260914180000_superadmin_dashboard_rpc.sql
-- REQ: ORG-ISOLATION / ORG-PROVISION — Global tenant summary RPC for super_admin

-- 1. Upewnij się, że kolumny address i resident_limit istnieją w organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS resident_limit integer DEFAULT 50;

-- 2. Funkcja agregująca podsumowanie placówek (dostępna wyłącznie dla super_admin)
CREATE OR REPLACE FUNCTION public.get_superadmin_organization_summary()
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  address text,
  resident_limit integer,
  created_at timestamptz,
  active_resident_count bigint,
  staff_count bigint,
  administrator_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text;
BEGIN
  v_caller_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
    ''
  );

  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Odmowa dostępu: Wymagana rola super_admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    org.id AS organization_id,
    org.name AS organization_name,
    org.address,
    COALESCE(org.resident_limit, 50) AS resident_limit,
    org.created_at,
    (
      SELECT count(*)
      FROM public.residents res
      WHERE res.organization_id = org.id
        AND res.archived_at IS NULL
    ) AS active_resident_count,
    (
      SELECT count(*)
      FROM auth.users u
      WHERE (
        u.raw_app_meta_data->>'organization_id' = org.id::text
        OR u.raw_user_meta_data->>'organization_id' = org.id::text
      )
      AND (
        u.raw_app_meta_data->>'role' IN ('org_admin', 'nurse', 'paramedic', 'caregiver')
        OR u.raw_user_meta_data->>'role' IN ('org_admin', 'nurse', 'paramedic', 'caregiver')
      )
    ) AS staff_count,
    (
      SELECT count(*)
      FROM auth.users u
      WHERE (
        u.raw_app_meta_data->>'organization_id' = org.id::text
        OR u.raw_user_meta_data->>'organization_id' = org.id::text
      )
      AND (
        u.raw_app_meta_data->>'role' = 'org_admin'
        OR u.raw_user_meta_data->>'role' = 'org_admin'
      )
    ) AS administrator_count
  FROM public.organizations org
  ORDER BY org.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_superadmin_organization_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_superadmin_organization_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_superadmin_organization_summary() TO authenticated;

COMMENT ON FUNCTION public.get_superadmin_organization_summary() IS
  'SC-SUP-01 global tenant summary without client-side joins. Strict super_admin check.';
