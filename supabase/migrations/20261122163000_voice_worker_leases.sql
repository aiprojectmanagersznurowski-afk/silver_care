-- @REQ: VOICE-RETENTION
-- @REQ: VOICE-DOCK-REPORTS
-- @REQ: ORG-ISOLATION

ALTER TABLE public.voice_storage_deletions
  ADD COLUMN lease_token uuid,
  ADD COLUMN leased_until timestamptz;
CREATE INDEX voice_storage_deletions_lease ON public.voice_storage_deletions(lease_token)
  WHERE lease_token IS NOT NULL;

CREATE FUNCTION public.claim_voice_storage_deletions()
RETURNS SETOF public.voice_storage_deletions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_token uuid := gen_random_uuid();
BEGIN
  PERFORM private.require_report_service();
  RETURN QUERY WITH pending AS (
    SELECT path FROM public.voice_storage_deletions
    WHERE leased_until IS NULL OR leased_until < now()
    ORDER BY queued_at, path LIMIT 50 FOR UPDATE SKIP LOCKED
  )
  UPDATE public.voice_storage_deletions d SET lease_token = v_token, leased_until = now() + interval '10 minutes'
    FROM pending p WHERE d.path = p.path RETURNING d.*;
END $$;

CREATE FUNCTION public.finish_voice_storage_deletions(p_token uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_count integer;
BEGIN
  PERFORM private.require_report_service();
  DELETE FROM public.voice_storage_deletions WHERE lease_token = p_token;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE DELETE ON public.voice_storage_deletions FROM service_role;

CREATE FUNCTION public.read_operational_report_material(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_job public.operational_report_jobs; v_config public.organization_report_configs;
BEGIN
  PERFORM private.require_report_service();
  SELECT * INTO v_job FROM public.operational_report_jobs WHERE lease_token = p_token AND available_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_REPORT_LEASE_EXPIRED' USING ERRCODE = '23514'; END IF;
  SELECT * INTO v_config FROM public.organization_report_configs WHERE organization_id = v_job.organization_id
    AND category_code = v_job.category_code AND is_enabled AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_REPORT_CATEGORY_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'category', jsonb_build_object('code', v_config.category_code, 'label', v_config.category_label,
      'classifierHint', v_config.classifier_hint, 'allowedSections', v_config.allowed_sections,
      'enabled', v_config.is_enabled, 'archivedAt', v_config.archived_at),
    'events', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'sanitizedText', e.sanitized_text)
        ORDER BY e.recorded_at, e.id), '[]'::jsonb)
      FROM public.voice_sanitized_events e
      WHERE e.organization_id = v_job.organization_id AND e.metadata->>'pipeline_stage' = 'CLASSIFY'
        AND e.recorded_at >= v_job.period_start AND e.recorded_at < v_job.period_end
        AND v_job.category_code = ANY(e.matched_categories)),
    'registry', jsonb_build_object(
      'residentNames', (SELECT COALESCE(jsonb_agg(name), '[]'::jsonb) FROM (
        SELECT concat_ws(' ', first_name, last_name) AS name FROM public.residents WHERE organization_id = v_job.organization_id
        UNION SELECT raw_user_meta_data->>'full_name' FROM auth.users
          WHERE raw_app_meta_data->>'organization_id' = v_job.organization_id::text
          AND raw_user_meta_data->>'full_name' IS NOT NULL
      ) names),
      'rooms', (SELECT COALESCE(jsonb_agg(DISTINCT r.number::text), '[]'::jsonb)
        FROM public.rooms r WHERE r.organization_id = v_job.organization_id),
      'beds', (SELECT COALESCE(jsonb_agg(DISTINCT b.label), '[]'::jsonb)
        FROM public.beds b JOIN public.rooms r ON r.id = b.room_id WHERE r.organization_id = v_job.organization_id)
    ));
END $$;

REVOKE ALL ON FUNCTION public.claim_voice_storage_deletions(), public.finish_voice_storage_deletions(uuid),
  public.read_operational_report_material(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_voice_storage_deletions(), public.finish_voice_storage_deletions(uuid),
  public.read_operational_report_material(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
