-- @REQ: CONSENT-GRANTOR @REQ: ORG-ISOLATION @REQ: SEC-AUDIT-APPEND-ONLY
DROP POLICY consent_ledger_insert ON public.consent_ledger;
CREATE POLICY consent_ledger_insert ON public.consent_ledger FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.jwt())->'app_metadata'->>'role' = 'org_admin'
    AND organization_id = (SELECT public.get_jwt_organization_id())
    AND purpose IN ('wellness_data_ingest', 'family_report_access', 'wellness_family_view')
    AND revoked_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.residents r WHERE r.id = resident_id
        AND r.organization_id = consent_ledger.organization_id AND r.archived_at IS NULL
    )
  );

CREATE FUNCTION private.record_consent_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('role') = 'authenticated' THEN
    INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
    VALUES (NEW.organization_id, NEW.resident_id, 'CONSENT_GRANTED', auth.uid(),
      jsonb_build_object('consent_id', NEW.id, 'purpose', NEW.purpose, 'grantor', NEW.granted_by));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.record_consent_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER record_consent_audit AFTER INSERT ON public.consent_ledger
  FOR EACH ROW EXECUTE FUNCTION private.record_consent_audit();
