-- @REQ: NUR-TASKS-VOICE-COMPLETION
-- Dowód APP wiąże zredagowany szkic z konkretnym przesłanym nagraniem. Edycja lub uzupełnienie szkicu unieważnia dowód.
CREATE TABLE private.app_voice_task_recordings (
  draft_id uuid PRIMARY KEY REFERENCES public.voice_draft_notes(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  audio_sha256 text NOT NULL CHECK (audio_sha256 ~ '^[0-9a-f]{64}$'),
  transcript_sha256 bytea NOT NULL
);
REVOKE ALL ON private.app_voice_task_recordings FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.record_app_voice_task_draft(
  p_author_id uuid, p_resident_id uuid, p_client_uuid uuid, p_transcript text, p_recorded_at timestamptz, p_audio_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_draft uuid; v_previous record; v_org uuid;
BEGIN
  PERFORM private.require_report_service();
  SELECT organization_id INTO v_org FROM public.residents WHERE id = p_resident_id AND archived_at IS NULL;
  IF v_org IS NULL OR NOT public.has_org_feature(v_org, 'module_voice_and_reports') OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_author_id AND raw_app_meta_data->>'role' = 'nurse'
      AND raw_app_meta_data->>'organization_id' = v_org::text AND raw_app_meta_data->>'is_active' IS DISTINCT FROM 'false'
  ) THEN
    RAISE EXCEPTION 'VOICE_TASK_APP_SCOPE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_client_uuid IS NULL OR p_recorded_at IS NULL OR p_recorded_at > now() + interval '1 minute'
    OR p_audio_hash IS NULL OR p_audio_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_VOICE_TASK_APP_SOURCE' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.voice_draft_notes (resident_id, nurse_id, transcript, audio_url, client_uuid)
    VALUES (p_resident_id, p_author_id, p_transcript, 'local-only', p_client_uuid)
    ON CONFLICT (client_uuid) DO NOTHING RETURNING id INTO v_draft;
  IF FOUND THEN
    INSERT INTO private.app_voice_task_recordings (draft_id, recorded_at, audio_sha256, transcript_sha256)
      VALUES (v_draft, p_recorded_at, p_audio_hash, sha256(convert_to(p_transcript, 'UTF8')));
    RETURN jsonb_build_object('draft_id', v_draft, 'transcript', p_transcript);
  END IF;
  SELECT d.id, d.transcript INTO v_previous
    FROM public.voice_draft_notes d JOIN private.app_voice_task_recordings a ON a.draft_id = d.id
    WHERE d.client_uuid = p_client_uuid AND d.resident_id = p_resident_id AND d.nurse_id = p_author_id
      AND a.audio_sha256 = p_audio_hash AND a.recorded_at = p_recorded_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_TASK_APP_SOURCE_CONFLICT' USING ERRCODE = '23505'; END IF;
  RETURN jsonb_build_object('draft_id', v_previous.id, 'transcript', v_previous.transcript);
END $$;

CREATE FUNCTION private.invalidate_modified_app_task_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (OLD.transcript, OLD.resident_id, OLD.nurse_id) IS DISTINCT FROM (NEW.transcript, NEW.resident_id, NEW.nurse_id) THEN
    DELETE FROM public.shift_task_voice_suggestions WHERE draft_id = OLD.id;
    DELETE FROM private.app_voice_task_recordings WHERE draft_id = OLD.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invalidate_modified_app_task_evidence AFTER UPDATE OF transcript, resident_id, nurse_id ON public.voice_draft_notes
  FOR EACH ROW EXECUTE FUNCTION private.invalidate_modified_app_task_evidence();

CREATE INDEX shift_tasks_voice_pending_scope ON public.shift_tasks
  (organization_id, shift_definition_id, shift_date, resident_id) WHERE status = 'TODO';

CREATE FUNCTION public.sync_voice_task_suggestions(
  p_segment_id uuid, p_draft_id uuid, p_token uuid, p_matches jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_source record;
  v_shift uuid;
  v_date date;
  v_local timestamp;
  v_shift_count bigint;
  v_item record;
  v_task public.shift_tasks;
BEGIN
  PERFORM private.require_report_service();
  IF (p_segment_id IS NULL) = (p_draft_id IS NULL) OR p_token IS NULL THEN
    RAISE EXCEPTION 'INVALID_VOICE_TASK_LEASE' USING ERRCODE = '22023';
  END IF;
  IF p_segment_id IS NOT NULL THEN
    -- Utrzymuj kolejność zgodną z retencją i decyzją kierownika.
    PERFORM c.id FROM public.voice_captures c JOIN public.voice_segments s ON s.capture_id = c.id
      WHERE s.id = p_segment_id FOR SHARE OF c;
    SELECT s.organization_id, s.resident_id, s.author_id, s.author_attribution, c.source AS source_kind,
      c.recorded_at, c.received_at, NULL::timestamptz AS draft_updated_at INTO v_source
    FROM public.voice_segments s JOIN public.voice_captures c ON c.id = s.capture_id
    LEFT JOIN public.voice_retention_settings r ON r.organization_id = c.organization_id
    WHERE s.id = p_segment_id AND s.projection_token = p_token AND s.projection_status = 'PROCESSING'
      AND s.assignment_status IN ('RESIDENT','FACILITY') AND s.author_id IS NOT NULL
      AND c.source IN ('APP_GENERAL','DEVICE') AND c.status = 'SEGMENTED' AND c.clock_state <> 'UNKNOWN'
      AND c.received_at >= now() - make_interval(days => COALESCE(r.retention_days, 30))
    FOR NO KEY UPDATE OF s;
  ELSE
    PERFORM d.id FROM public.voice_draft_notes d WHERE d.id = p_draft_id FOR SHARE;
    SELECT r.organization_id, d.resident_id, d.nurse_id AS author_id, 'AUTHENTICATED_SESSION'::text AS author_attribution,
      'APP'::text AS source_kind, a.recorded_at, d.created_at AS received_at, d.updated_at AS draft_updated_at INTO v_source
    FROM public.voice_draft_notes d JOIN private.app_voice_task_recordings a ON a.draft_id = d.id
    JOIN public.voice_app_report_jobs j ON j.draft_id = d.id JOIN public.residents r ON r.id = d.resident_id
    WHERE d.id = p_draft_id AND d.status = 'PROCESSED' AND j.token = p_token AND j.completed_at IS NULL
      AND r.archived_at IS NULL AND d.updated_at IS NOT NULL AND d.created_at >= now() - interval '30 days'
      AND a.transcript_sha256 = sha256(convert_to(d.transcript, 'UTF8'))
    FOR UPDATE OF j;
  END IF;
  IF NOT FOUND OR NOT public.has_org_feature(v_source.organization_id, 'module_voice_and_reports')
    OR NOT public.has_org_feature(v_source.organization_id, 'module_shift_tasks') THEN
    RETURN '[]'::jsonb;
  END IF;

  -- SHIFT_POLICY.timezone. Data nocnej zmiany jest datą jej rozpoczęcia.
  v_local := v_source.recorded_at AT TIME ZONE 'Europe/Warsaw';
  SELECT id, CASE WHEN crosses_midnight AND v_local::time < end_time THEN v_local::date - 1 ELSE v_local::date END,
    count(*) OVER () INTO v_shift, v_date, v_shift_count
  FROM public.shift_definitions WHERE organization_id = v_source.organization_id AND is_active
    AND CASE WHEN crosses_midnight THEN v_local::time >= start_time OR v_local::time < end_time
      ELSE v_local::time >= start_time AND v_local::time < end_time END
  ORDER BY id LIMIT 1;
  IF v_shift_count IS DISTINCT FROM 1 THEN RETURN '[]'::jsonb; END IF;

  IF p_matches IS NULL THEN
    RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'updated_at', t.updated_at) ORDER BY t.id), '[]'::jsonb)
      FROM public.shift_tasks t WHERE t.organization_id = v_source.organization_id
        AND t.shift_definition_id = v_shift AND t.shift_date = v_date AND t.status = 'TODO'
        AND (t.resident_id = v_source.resident_id OR (v_source.resident_id IS NULL AND t.resident_id IS NULL))
        AND NOT EXISTS (SELECT 1 FROM public.shift_tasks WHERE carried_from_task_id = t.id));
  END IF;
  IF jsonb_typeof(p_matches) <> 'array' OR length(p_matches::text) > 16000 THEN
    RAISE EXCEPTION 'INVALID_VOICE_TASK_MATCHES' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_matches)
    AS m(task_id uuid, task_updated_at timestamptz, fragment_index integer, kind text, quote text) ORDER BY task_id, fragment_index
  LOOP
    SELECT * INTO v_task FROM public.shift_tasks WHERE id = v_item.task_id AND organization_id = v_source.organization_id
      AND shift_definition_id = v_shift AND shift_date = v_date AND status = 'TODO'
      AND resident_id IS NOT DISTINCT FROM v_source.resident_id AND updated_at = v_item.task_updated_at FOR NO KEY UPDATE;
    IF NOT FOUND OR EXISTS (SELECT 1 FROM public.shift_tasks WHERE carried_from_task_id = v_task.id) THEN CONTINUE; END IF;
    PERFORM private.assert_no_org_registry_identifiers(v_source.organization_id, v_item.quote);
    INSERT INTO public.shift_task_voice_suggestions (
      organization_id, shift_definition_id, shift_date, task_id, resident_id, segment_id, draft_id, source_id,
      fragment_index, source_kind, author_id, author_attribution, recorded_at, received_at, draft_updated_at, task_updated_at, kind, quote
    ) VALUES (
      v_source.organization_id, v_shift, v_date, v_task.id, v_source.resident_id, p_segment_id, p_draft_id, COALESCE(p_segment_id, p_draft_id),
      v_item.fragment_index, v_source.source_kind, v_source.author_id, v_source.author_attribution,
      v_source.recorded_at, v_source.received_at, v_source.draft_updated_at, v_task.updated_at, v_item.kind, v_item.quote
    ) ON CONFLICT (task_id, source_kind, source_id, fragment_index) DO NOTHING;
  END LOOP;
  RETURN '[]'::jsonb;
END $$;

REVOKE ALL ON FUNCTION private.invalidate_modified_app_task_evidence(),
  public.record_app_voice_task_draft(uuid,uuid,uuid,text,timestamptz,text),
  public.sync_voice_task_suggestions(uuid,uuid,uuid,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_app_voice_task_draft(uuid,uuid,uuid,text,timestamptz,text),
  public.sync_voice_task_suggestions(uuid,uuid,uuid,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
