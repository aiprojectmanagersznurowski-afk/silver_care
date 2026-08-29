-- Migration: 20260829060000_security_mfa.sql

CREATE OR REPLACE FUNCTION public.check_mfa_requirement()
RETURNS boolean AS $$
DECLARE
    claims jsonb;
    user_role text;
    user_aal text;
BEGIN
    claims := current_setting('request.jwt.claims', true)::jsonb;
    
    -- If no claims (e.g. system backend), skip checks
    IF claims IS NULL THEN
        RETURN true;
    END IF;

    user_role := COALESCE(claims->'app_metadata'->>'role', '');
    user_aal := COALESCE(claims->>'aal', 'aal1');

    -- SEC-MFA-STAFF requirement
    IF user_role IN ('super_admin', 'org_admin', 'nurse') AND user_aal != 'aal2' THEN
        RAISE EXCEPTION 'MFA (aal2) required for staff roles';
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Zastosowanie polityk RESTRICTIVE do tabel (Postgres pozwala zdefiniować politykę 
-- jako RESTRICTIVE, co oznacza że MUSI być spełniona niezależnie od innych polityk PERMISSIVE).

-- residents
CREATE POLICY "mfa_enforcement_residents" ON public.residents
AS RESTRICTIVE FOR ALL
USING (public.check_mfa_requirement());

-- organizations
CREATE POLICY "mfa_enforcement_organizations" ON public.organizations
AS RESTRICTIVE FOR ALL
USING (public.check_mfa_requirement());

-- consent_ledger
CREATE POLICY "mfa_enforcement_consent_ledger" ON public.consent_ledger
AS RESTRICTIVE FOR ALL
USING (public.check_mfa_requirement());

-- resident_relative_links
CREATE POLICY "mfa_enforcement_resident_relative_links" ON public.resident_relative_links
AS RESTRICTIVE FOR ALL
USING (public.check_mfa_requirement());

-- beds
CREATE POLICY "mfa_enforcement_beds" ON public.beds
AS RESTRICTIVE FOR ALL
USING (public.check_mfa_requirement());

-- bed_assignments
CREATE POLICY "mfa_enforcement_bed_assignments" ON public.bed_assignments
AS RESTRICTIVE FOR ALL
USING (public.check_mfa_requirement());
