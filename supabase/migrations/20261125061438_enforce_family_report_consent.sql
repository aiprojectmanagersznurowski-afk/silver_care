-- @REQ: CONSENT-GRANTOR @REQ: CONSENT-REVOKE
ALTER TABLE public.consent_ledger DROP CONSTRAINT valid_purpose;
-- Stare cele zostają w historii. Dostęp sprawdza wyłącznie konkretne cele z kontraktu.
ALTER TABLE public.consent_ledger ADD CONSTRAINT valid_purpose CHECK (purpose IN (
  'wellness_data_ingest', 'family_report_access', 'wellness_family_view',
  'medical_records_access', 'family_view_basic', 'family_view_full'
));
CREATE INDEX consent_ledger_latest_purpose
  ON public.consent_ledger (resident_id, organization_id, purpose, granted_at DESC, id DESC);

CREATE FUNCTION private.latest_active_consent(p_resident uuid, p_org uuid, p_purpose text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT l.revoked_at IS NULL
    FROM public.consent_ledger l
    WHERE l.resident_id = p_resident AND l.organization_id = p_org AND l.purpose = p_purpose
    ORDER BY l.granted_at DESC, l.id DESC LIMIT 1
  ), false);
$$;

DROP POLICY "Family can read published daily reports" ON public.daily_reports;

CREATE FUNCTION public.get_family_daily_reports(p_resident_id uuid)
RETURNS TABLE (id uuid, resident_id uuid, created_at timestamptz, status text, content jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH access AS (
    SELECT r.id,
      private.latest_active_consent(r.id, r.organization_id, 'family_report_access') AS can_read_report,
      private.latest_active_consent(r.id, r.organization_id, 'wellness_family_view') AS can_read_metrics
    FROM public.residents r
    WHERE r.id = p_resident_id AND r.organization_id = public.get_jwt_organization_id()
      AND auth.uid() IS NOT NULL AND auth.jwt()->'app_metadata'->>'role' IN ('family', 'legal_guardian')
      AND public.is_relative_active_or_retained(r.id)
  )
  SELECT dr.id, dr.resident_id, dr.created_at, dr.status,
    CASE WHEN a.can_read_report THEN jsonb_strip_nulls(jsonb_build_object(
      'text', dr.content->'text', 'msg', dr.content->'msg'
    )) ELSE '{}'::jsonb END
    || CASE WHEN a.can_read_metrics AND m.metrics <> '{}'::jsonb
      THEN jsonb_build_object('metrics', m.metrics) || m.legacy_view
      ELSE '{}'::jsonb END
  FROM access a JOIN public.daily_reports dr ON dr.resident_id = a.id
  CROSS JOIN LATERAL (
    -- FAMILY_VISIBLE_METRICS z presentation.contract.mjs. steps i sleep_hours
    -- zachowują kształt starszych raportów dla bieżącego widoku portalu.
    SELECT
      jsonb_strip_nulls(jsonb_build_object(
        'steps', COALESCE(dr.content#>'{metrics,steps}', dr.content->'steps_total'),
        'sleep_hours', COALESCE(dr.content#>'{metrics,sleep_hours}',
          CASE WHEN jsonb_typeof(dr.content->'sleep_duration_min') = 'number'
            THEN to_jsonb((dr.content->>'sleep_duration_min')::numeric / 60) END),
        'active_minutes', COALESCE(dr.content#>'{metrics,active_minutes}', dr.content->'active_minutes'),
        'sleep_start_time', COALESCE(dr.content#>'{metrics,sleep_start_time}', dr.content->'sleep_start_time'),
        'sleep_end_time', COALESCE(dr.content#>'{metrics,sleep_end_time}', dr.content->'sleep_end_time')
      )) AS metrics,
      jsonb_strip_nulls(jsonb_build_object(
        'steps_total', dr.content->'steps_total',
        'active_minutes', dr.content->'active_minutes'
      )) AS legacy_view
  ) m
  WHERE dr.status = 'PUBLISHED' AND (a.can_read_report OR (a.can_read_metrics AND m.metrics <> '{}'::jsonb));
$$;

REVOKE ALL ON FUNCTION private.latest_active_consent(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_family_daily_reports(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_daily_reports(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
