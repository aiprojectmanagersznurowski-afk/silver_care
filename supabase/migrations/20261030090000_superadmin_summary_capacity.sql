-- ADM-CAPACITY-LIMIT (SC-ADM-22/AC5): podsumowanie placówek dla super admina z limitem miejsc.
-- - active_resident_count: podopieczni przebywający w placówce (decyzja Michała 2026-10-29):
--   bez zarchiwizowanych, zmarłych i z umową zakończoną dziś lub wcześniej (Europe/Warsaw).
-- - active_bed_count: aktywne łóżka placówki (super admin nie czyta tabeli beds przez RLS).
-- - over_capacity_limit: łóżka albo podopieczni ponad resident_limit.
-- Zmiana typu zwracanego wymaga DROP; nowe kolumny są dopisane na końcu, więc obecna aplikacja
-- (mapuje kolumny po nazwie) działa bez zmian także przed wdrożeniem nowego kodu.

DROP FUNCTION IF EXISTS public.get_superadmin_organization_summary();

CREATE FUNCTION public.get_superadmin_organization_summary()
 RETURNS TABLE(
   organization_id uuid, organization_name text, address text, resident_limit integer,
   created_at timestamp with time zone, active_resident_count bigint, staff_count bigint,
   administrator_count bigint, active_bed_count bigint, over_capacity_limit boolean
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_caller_role text;
  v_today date := (now() AT TIME ZONE 'Europe/Warsaw')::date;
BEGIN
  v_caller_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
    ''
  );

  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Odmowa dostępu: Wymagana rola super_admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH counts AS (
    SELECT
      org.id,
      (
        SELECT count(*) FROM public.residents res
        WHERE res.organization_id = org.id
          AND res.archived_at IS NULL
          AND res.death_date IS NULL
          AND (res.contract_end_date IS NULL OR res.contract_end_date > v_today)
      ) AS present_residents,
      (
        SELECT count(*) FROM public.beds b JOIN public.rooms r ON r.id = b.room_id
        WHERE r.organization_id = org.id AND b.is_active
      ) AS active_beds
    FROM public.organizations org
  )
  SELECT
    org.id AS organization_id,
    org.name AS organization_name,
    org.address,
    COALESCE(org.resident_limit, 50) AS resident_limit,
    org.created_at,
    c.present_residents AS active_resident_count,
    (
      SELECT count(*)
      FROM auth.users u
      WHERE u.raw_app_meta_data->>'organization_id' = org.id::text
        AND u.raw_app_meta_data->>'role' IN ('org_admin', 'nurse')
    ) AS staff_count,
    (
      SELECT count(*)
      FROM auth.users u
      WHERE u.raw_app_meta_data->>'organization_id' = org.id::text
        AND u.raw_app_meta_data->>'role' = 'org_admin'
    ) AS administrator_count,
    c.active_beds AS active_bed_count,
    (c.active_beds > COALESCE(org.resident_limit, 50) OR c.present_residents > COALESCE(org.resident_limit, 50)) AS over_capacity_limit
  FROM public.organizations org
  JOIN counts c ON c.id = org.id
  ORDER BY org.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_superadmin_organization_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_superadmin_organization_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_superadmin_organization_summary() TO authenticated;
