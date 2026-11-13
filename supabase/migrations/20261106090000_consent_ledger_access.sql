-- Migration: 20261106090000_consent_ledger_access.sql
-- @REQ: CONSENT-LEDGER-IMMUTABLE, @REQ: CONSENT-GRANTOR, @REQ: CONSENT-REVOKE
--
-- Rejestr zgód (dane art. 9 RODO) zgodnie z macierzą uprawnień (roles.contract.mjs: consent_ledger
-- read = org_admin:own, legal_guardian:own; update i delete = brak). Do tej pory:
--  - polityka consent_ledger_isolation sprawdzała tylko organizację, więc rejestr całej placówki czytał
--    każdy zalogowany z tej placówki, także family i nurse;
--  - revoke_consent nie sprawdzał roli ani powiązania, nie miał search_path, miał EXECUTE dla PUBLIC i anon,
--    ponowne cofnięcie nadpisywało revoked_at, a audyt nie zapisywał autora.
-- Zapis zgód (klient serwisowy) i funkcje odbioru danych z opaski (SECURITY DEFINER) nie są dotknięte.

-- 1. Odczyt: kierownik placówki (własnej) i opiekun prawny (tylko swojego podopiecznego)
DROP POLICY IF EXISTS "consent_ledger_isolation" ON public.consent_ledger;
DROP POLICY IF EXISTS "consent_ledger_org_admin_select" ON public.consent_ledger;
DROP POLICY IF EXISTS "consent_ledger_guardian_select" ON public.consent_ledger;

CREATE POLICY "consent_ledger_org_admin_select" ON public.consent_ledger
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

CREATE POLICY "consent_ledger_guardian_select" ON public.consent_ledger
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'legal_guardian' AND
    EXISTS (
      SELECT 1 FROM public.resident_relative_links rrl
      WHERE rrl.resident_id = consent_ledger.resident_id
        AND rrl.relative_user_id = auth.uid()
        AND rrl.role = 'legal_guardian'
    )
  );

-- 2. Cofnięcie zgody: kierownik placówki (rejestruje cofnięcie przez samego pensjonariusza)
--    albo powiązany opiekun prawny. Rola family nie cofa zgód (CONSENT-GRANTOR).
CREATE OR REPLACE FUNCTION public.revoke_consent(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '');
  v_res_id uuid;
  v_org_id uuid;
  v_revoked_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CONSENT_REVOKE_FORBIDDEN: brak zalogowanego użytkownika' USING ERRCODE = '42501';
  END IF;

  SELECT resident_id, organization_id, revoked_at INTO v_res_id, v_org_id, v_revoked_at
  FROM public.consent_ledger
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND OR v_org_id IS DISTINCT FROM public.get_jwt_organization_id() THEN
    RAISE EXCEPTION 'CONSENT_NOT_FOUND: brak zgody w tej placówce' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_role = 'org_admin'
    OR (
      v_role = 'legal_guardian' AND EXISTS (
        SELECT 1 FROM public.resident_relative_links rrl
        WHERE rrl.resident_id = v_res_id AND rrl.relative_user_id = v_uid AND rrl.role = 'legal_guardian'
      )
    )
  ) THEN
    RAISE EXCEPTION 'CONSENT_REVOKE_FORBIDDEN: zgodę cofa kierownik placówki albo opiekun prawny podopiecznego' USING ERRCODE = '42501';
  END IF;

  -- Rejestr jest niezmienialny: cofnięcie to jednorazowa zmiana stanu, nie edycja wiersza
  IF v_revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'CONSENT_ALREADY_REVOKED: zgoda została już cofnięta' USING ERRCODE = '23514';
  END IF;

  UPDATE public.consent_ledger SET revoked_at = now() WHERE id = p_id;

  -- Ślad w audycie: identyfikatory i autor, bez treści (SEC-NO-PII-LOGS)
  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
  VALUES (v_org_id, v_res_id, 'CONSENT_WITHDRAWN', v_uid, jsonb_build_object('consent_id', p_id));
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_consent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_consent(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_consent(uuid) TO authenticated;
