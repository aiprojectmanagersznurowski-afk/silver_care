-- Migration: 20260831130000_disable_mfa_mvp.sql
-- Tymczasowe wyłączenie wymogu MFA dla etapu MVP.
-- TODO: Przywrócić po implementacji TOTP w panelu logowania.

DROP POLICY IF EXISTS "mfa_enforcement_residents" ON public.residents;
DROP POLICY IF EXISTS "mfa_enforcement_organizations" ON public.organizations;
DROP POLICY IF EXISTS "mfa_enforcement_consent_ledger" ON public.consent_ledger;
DROP POLICY IF EXISTS "mfa_enforcement_resident_relative_links" ON public.resident_relative_links;
DROP POLICY IF EXISTS "mfa_enforcement_beds" ON public.beds;
DROP POLICY IF EXISTS "mfa_enforcement_bed_assignments" ON public.bed_assignments;
