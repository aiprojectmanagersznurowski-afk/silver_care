-- ADM-CAPACITY-LIMIT (SC-ADM-22, CAPACITY_POLICY w facility.contract.mjs):
-- limit miejsc placówki (organizations.resident_limit) zmienia wyłącznie super admin.
--
-- Polityka RLS organizations_update dopuszcza org_admin do własnego wiersza (potrzebne dla
-- settings.bed_allocation_rules, #149), więc blokada działa na poziomie kolumny, triggerem.
-- Blokuje też klucz service_role — masowy import podnosił nim limit „po cichu”.
-- Zapytanie bez claims JWT (migracje, praca administracyjna na bazie) nie jest blokowane.

CREATE OR REPLACE FUNCTION public.guard_resident_limit_super_admin_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_claims jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
BEGIN
  IF NEW.resident_limit IS DISTINCT FROM OLD.resident_limit
     AND v_claims IS NOT NULL
     AND COALESCE(v_claims->'app_metadata'->>'role', '') <> 'super_admin' THEN
    RAISE EXCEPTION 'CAPACITY_LIMIT_SUPER_ADMIN_ONLY: limit miejsc placówki zmienia wyłącznie super admin'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS organizations_resident_limit_guard ON public.organizations;
CREATE TRIGGER organizations_resident_limit_guard
  BEFORE UPDATE OF resident_limit ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_resident_limit_super_admin_only();
