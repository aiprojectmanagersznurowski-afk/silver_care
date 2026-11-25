-- @REQ: CONSENT-GRANTOR @REQ: SEC-AUDIT-APPEND-ONLY
ALTER TABLE public.consent_ledger ADD COLUMN grantor_user_id uuid;

CREATE FUNCTION private.verify_consent_grantor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.granted_by = 'legal_guardian' AND NOT EXISTS (
    SELECT 1 FROM public.resident_relative_links l
    JOIN public.residents r ON r.id = l.resident_id
    JOIN auth.users u ON u.id = l.relative_user_id
    WHERE l.resident_id = NEW.resident_id AND r.organization_id = NEW.organization_id
      AND l.relative_user_id = NEW.grantor_user_id AND l.role = 'legal_guardian'
      AND u.raw_app_meta_data->>'role' = 'legal_guardian'
      AND u.raw_app_meta_data->>'organization_id' = NEW.organization_id::text
  ) OR (NEW.granted_by = 'resident_self' AND NEW.grantor_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'CONSENT_GRANTOR_UNVERIFIED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION private.verify_consent_grantor() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER verify_consent_grantor BEFORE INSERT ON public.consent_ledger
  FOR EACH ROW EXECUTE FUNCTION private.verify_consent_grantor();

CREATE OR REPLACE FUNCTION private.record_consent_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('role') IN ('authenticated', 'service_role') THEN
    INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
    VALUES (NEW.organization_id, NEW.resident_id, 'CONSENT_GRANTED', COALESCE(auth.uid(), NEW.grantor_user_id),
      jsonb_strip_nulls(jsonb_build_object('consent_id', NEW.id, 'purpose', NEW.purpose,
        'grantor', NEW.granted_by, 'grantor_user_id', NEW.grantor_user_id)));
  END IF;
  RETURN NEW;
END $$;
NOTIFY pgrst, 'reload schema';
