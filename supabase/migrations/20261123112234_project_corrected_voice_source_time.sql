-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: NUR-TASKS-VOICE-COMPLETION
-- @REQ: VOICE-DOCK-REPORTS

CREATE FUNCTION private.voice_segment_effective_at(p_segment public.voice_segments, p_capture public.voice_captures)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(p_segment.corrected_at, CASE WHEN p_capture.clock_state <> 'UNKNOWN' THEN p_capture.recorded_at END)
$$;
REVOKE ALL ON FUNCTION private.voice_segment_effective_at(public.voice_segments,public.voice_captures)
  FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.record_voice_sanitized_event(
  p_org_id text, p_draft_note_id text, p_capture_source text, p_scope text, p_resident_id text,
  p_author_id text, p_sanitized_text text, p_matched_categories_json text, p_recorded_at text, p_metadata_json text
) RETURNS public.voice_sanitized_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_org uuid; v_draft uuid; v_resident uuid; v_author uuid; v_segment uuid;
  v_categories text[]; v_recorded timestamptz; v_metadata jsonb;
  v_row public.voice_sanitized_events;
BEGIN
  PERFORM private.require_report_service();
  v_org := private.parse_uuid_strict(p_org_id);
  v_draft := private.parse_optional_uuid_strict(p_draft_note_id);
  v_resident := private.parse_optional_uuid_strict(p_resident_id);
  v_author := private.parse_uuid_strict(p_author_id);
  v_categories := private.parse_text_array_json_strict(p_matched_categories_json);
  v_recorded := private.parse_timestamptz_strict(p_recorded_at);
  v_metadata := private.parse_jsonb_strict(p_metadata_json);
  IF NOT public.has_org_feature(v_org, 'module_voice_and_reports') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_metadata) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_each(v_metadata) e
    WHERE e.key NOT IN ('pipeline_stage', 'capture_device_id', 'assignment_id', 'segment_id')
      OR jsonb_typeof(e.value) <> 'string'
  ) OR COALESCE(v_metadata->>'pipeline_stage', '') NOT IN ('REDACT', 'CLASSIFY') THEN
    RAISE EXCEPTION 'INVALID_EVENT_METADATA' USING ERRCODE = '22023';
  END IF;
  PERFORM private.parse_optional_uuid_strict(v_metadata->>'capture_device_id');
  PERFORM private.parse_optional_uuid_strict(v_metadata->>'assignment_id');
  v_segment := private.parse_optional_uuid_strict(v_metadata->>'segment_id');
  IF private.report_required(p_capture_source) NOT IN ('APP', 'APP_GENERAL', 'DEVICE')
    OR private.report_required(p_scope) NOT IN ('resident', 'facility')
    OR (p_scope = 'resident') <> (v_resident IS NOT NULL)
    OR (p_capture_source = 'APP' AND p_scope <> 'resident') THEN
    RAISE EXCEPTION 'INVALID_CAPTURE_SCOPE' USING ERRCODE = '23514';
  END IF;
  IF p_capture_source <> 'APP' AND v_segment IS NULL THEN
    RAISE EXCEPTION 'DEVICE_ASSIGNMENT_QUEUE_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;
  IF (v_metadata->>'pipeline_stage' = 'REDACT' AND cardinality(v_categories) > 0)
    OR EXISTS (SELECT 1 FROM unnest(v_categories) c WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_report_configs r WHERE r.organization_id = v_org
        AND r.category_code = c AND r.is_enabled AND r.archived_at IS NULL
    )) THEN RAISE EXCEPTION 'INVALID_EVENT_STAGE_CATEGORIES' USING ERRCODE = '23514'; END IF;
  PERFORM private.report_required(p_sanitized_text);
  PERFORM private.assert_no_org_registry_identifiers(v_org, p_sanitized_text);

  IF v_resident IS NOT NULL THEN
    PERFORM id FROM public.residents WHERE id = v_resident AND organization_id = v_org
      AND archived_at IS NULL FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_EVENT_RESIDENT' USING ERRCODE = '23514'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_author
    AND raw_app_meta_data->>'organization_id' = v_org::text
    AND raw_app_meta_data->>'role' IN ('nurse', 'org_admin')) THEN
    RAISE EXCEPTION 'INVALID_EVENT_AUTHOR' USING ERRCODE = '23514';
  END IF;
  IF v_draft IS NOT NULL THEN
    PERFORM id FROM public.voice_draft_notes WHERE id = v_draft
      AND resident_id = v_resident AND nurse_id = v_author FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_EVENT_DRAFT_NOTE' USING ERRCODE = '23514'; END IF;
  END IF;
  IF v_segment IS NOT NULL THEN
    PERFORM s.id FROM public.voice_segments s JOIN public.voice_captures c ON c.id = s.capture_id
    WHERE s.id = v_segment AND s.organization_id = v_org AND c.source = p_capture_source
      AND s.resident_id IS NOT DISTINCT FROM v_resident AND s.author_id = v_author
      AND s.assignment_status = upper(p_scope)
      AND private.voice_segment_effective_at(s, c) = v_recorded
      AND (v_metadata->>'capture_device_id' IS NULL OR c.device_id::text = v_metadata->>'capture_device_id')
    FOR KEY SHARE OF s;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_EVENT_SEGMENT' USING ERRCODE = '23514'; END IF;
  END IF;

  INSERT INTO public.voice_sanitized_events
    (organization_id, draft_note_id, segment_id, capture_source, scope, resident_id, author_id,
      sanitized_text, matched_categories, recorded_at, metadata)
  VALUES (v_org, v_draft, v_segment, p_capture_source, p_scope, v_resident, v_author,
    p_sanitized_text, v_categories, v_recorded, v_metadata)
  ON CONFLICT DO NOTHING RETURNING * INTO v_row;
  IF FOUND THEN RETURN v_row; END IF;
  SELECT * INTO v_row FROM public.voice_sanitized_events
    WHERE organization_id = v_org AND (draft_note_id = v_draft OR segment_id = v_segment)
    ORDER BY id LIMIT 1;
  IF v_row.id IS NOT NULL AND ROW(v_row.draft_note_id, v_row.segment_id, v_row.capture_source, v_row.scope,
    v_row.resident_id, v_row.author_id, v_row.sanitized_text, v_row.matched_categories, v_row.recorded_at, v_row.metadata)
    IS NOT DISTINCT FROM ROW(v_draft, v_segment, p_capture_source, p_scope, v_resident, v_author,
      p_sanitized_text, v_categories, v_recorded, v_metadata) THEN RETURN v_row; END IF;
  RAISE EXCEPTION 'DUPLICATE_SANITIZED_EVENT_CONFLICT' USING ERRCODE = '23505';
END $$;

CREATE OR REPLACE FUNCTION public.complete_voice_segment_projection(p_segment_id uuid, p_token uuid, p_result jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_segment public.voice_segments; v_capture public.voice_captures;
  v_behavior text[]; v_operations text[]; v_medical text[]; v_codes text[]; v_fact text;
BEGIN
  PERFORM private.require_report_service();
  SELECT * INTO v_segment FROM public.voice_segments WHERE id = p_segment_id AND projection_token = p_token
    AND projection_status = 'PROCESSING' AND assignment_status IN ('RESIDENT','FACILITY') FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF p_result IS NULL THEN
    UPDATE public.voice_segments SET projection_status = CASE WHEN projection_attempts >= 5 THEN 'FAILED' ELSE 'WAITING' END,
      projection_token = NULL WHERE id = p_segment_id;
    RETURN true;
  END IF;
  IF jsonb_typeof(p_result) <> 'object' OR length(p_result::text) > 35000 THEN
    RAISE EXCEPTION 'INVALID_VOICE_PROJECTION' USING ERRCODE = '22023';
  END IF;

  v_behavior := private.parse_text_array_json_strict((p_result->'behavioral_facts')::text);
  v_operations := private.parse_text_array_json_strict((p_result->'operational_facts')::text);
  v_medical := private.parse_text_array_json_strict((p_result->'restricted_medical')::text);
  v_codes := private.parse_text_array_json_strict((p_result->'category_codes')::text);
  IF v_segment.resident_id IS NULL AND cardinality(v_behavior) <> 0 THEN
    RAISE EXCEPTION 'INVALID_VOICE_PROJECTION_SCOPE' USING ERRCODE = '23514';
  END IF;
  FOREACH v_fact IN ARRAY v_behavior || v_operations LOOP
    PERFORM private.report_required(v_fact);
    PERFORM private.assert_no_org_registry_identifiers(v_segment.organization_id, v_fact);
  END LOOP;
  SELECT * INTO STRICT v_capture FROM public.voice_captures WHERE id = v_segment.capture_id;
  v_capture.recorded_at := private.voice_segment_effective_at(v_segment, v_capture);
  IF v_capture.recorded_at IS NULL THEN
    UPDATE public.voice_segments SET projection_status = 'FAILED', projection_token = NULL WHERE id = p_segment_id;
    RETURN false;
  END IF;
  IF v_segment.corrected_at IS NOT NULL THEN v_capture.clock_state := 'VERIFIED'; END IF;

  IF cardinality(v_operations) > 0 THEN
    PERFORM public.record_voice_sanitized_event(v_segment.organization_id::text, NULL, v_capture.source,
      lower(v_segment.assignment_status), v_segment.resident_id::text, v_segment.author_id::text,
      array_to_string(v_operations, E'\n'), to_jsonb(v_codes)::text, to_jsonb(v_capture.recorded_at)#>>'{}',
      jsonb_build_object('pipeline_stage', 'CLASSIFY', 'segment_id', p_segment_id::text)::text);
  END IF;
  IF cardinality(v_behavior) > 0 OR cardinality(v_operations) > 0 THEN
    INSERT INTO public.voice_segment_proposals
      (segment_id, organization_id, capture_id, resident_id, author_id, recorded_at, time_state, behavioral_facts)
    VALUES (p_segment_id, v_segment.organization_id, v_capture.id, v_segment.resident_id, v_segment.author_id,
      v_capture.recorded_at, v_capture.clock_state, v_behavior);
  END IF;
  IF v_segment.resident_id IS NOT NULL AND cardinality(v_medical) > 0 THEN
    INSERT INTO public.daily_logs (resident_id, nurse_id, data)
    VALUES (v_segment.resident_id, v_segment.author_id, jsonb_build_object('voice_segment_id', p_segment_id,
      'medical', to_jsonb(v_medical)));
  END IF;
  PERFORM private.project_voice_shift_tasks(v_segment, v_capture, p_result->'proposed_tasks');
  UPDATE public.voice_segments SET projection_status = 'READY', projection_token = NULL WHERE id = p_segment_id;
  INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
    VALUES (v_segment.organization_id, v_segment.resident_id, 'VOICE_SEGMENT_PROJECTED',
      jsonb_build_object('segment_id', p_segment_id, 'capture_id', v_capture.id, 'author_id', v_segment.author_id));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION private.shift_task_voice_source_current(p_evidence public.shift_task_voice_suggestions)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_evidence.source_kind = 'APP' THEN EXISTS (
    SELECT 1 FROM public.voice_draft_notes d JOIN public.residents r ON r.id = d.resident_id
    WHERE d.id = p_evidence.draft_id AND d.status = 'PROCESSED'
      AND d.resident_id = p_evidence.resident_id AND d.nurse_id = p_evidence.author_id
      AND d.updated_at = p_evidence.draft_updated_at AND d.created_at = p_evidence.received_at
      -- Ta sama granica co w cleanup_voice_drafts (VOICE-RETENTION).
      AND d.created_at >= now() - interval '30 days'
      AND r.organization_id = p_evidence.organization_id AND r.archived_at IS NULL
  ) ELSE EXISTS (
    SELECT 1 FROM public.voice_segments s JOIN public.voice_captures c ON c.id = s.capture_id
    LEFT JOIN public.voice_retention_settings r ON r.organization_id = c.organization_id
    WHERE s.id = p_evidence.segment_id AND s.organization_id = p_evidence.organization_id
      AND s.resident_id IS NOT DISTINCT FROM p_evidence.resident_id AND s.author_id = p_evidence.author_id
      AND s.author_attribution = p_evidence.author_attribution AND s.assignment_status IN ('RESIDENT','FACILITY')
      AND (c.source = 'DEVICE' OR c.author_id = s.author_id)
      AND (s.resident_id IS NULL OR EXISTS (SELECT 1 FROM public.residents person
        WHERE person.id = s.resident_id AND person.organization_id = s.organization_id AND person.archived_at IS NULL))
      AND c.status = 'SEGMENTED' AND c.source = p_evidence.source_kind
      AND private.voice_segment_effective_at(s, c) = p_evidence.recorded_at AND c.received_at = p_evidence.received_at
      AND c.received_at >= now() - make_interval(days => COALESCE(r.retention_days, 30))
  ) END;
$$;

CREATE OR REPLACE FUNCTION public.sync_voice_task_suggestions(
  p_segment_id uuid, p_draft_id uuid, p_token uuid, p_matches jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_source record;
  v_shift uuid;
  v_date date;
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
      private.voice_segment_effective_at(s, c) AS recorded_at, c.received_at, NULL::timestamptz AS draft_updated_at, s.projection_attempts AS attempts INTO v_source
    FROM public.voice_segments s JOIN public.voice_captures c ON c.id = s.capture_id
    LEFT JOIN public.voice_retention_settings r ON r.organization_id = c.organization_id
    WHERE s.id = p_segment_id AND s.projection_token = p_token AND s.projection_status = 'PROCESSING'
      AND s.assignment_status IN ('RESIDENT','FACILITY') AND s.author_id IS NOT NULL
      AND ((c.source = 'APP_GENERAL' AND s.author_attribution = 'AUTHENTICATED_SESSION' AND s.author_id = c.author_id)
        OR (c.source = 'DEVICE' AND s.author_attribution IN ('DECLARED_SESSION','MANUAL_SEGMENT_CORRECTION')))
      AND (s.resident_id IS NULL OR EXISTS (SELECT 1 FROM public.residents person
        WHERE person.id = s.resident_id AND person.organization_id = s.organization_id AND person.archived_at IS NULL))
      AND c.status = 'SEGMENTED' AND private.voice_segment_effective_at(s, c) IS NOT NULL
      AND c.received_at >= now() - make_interval(days => COALESCE(r.retention_days, 30))
    FOR NO KEY UPDATE OF s;
  ELSE
    PERFORM d.id FROM public.voice_draft_notes d WHERE d.id = p_draft_id FOR SHARE;
    SELECT r.organization_id, d.resident_id, d.nurse_id AS author_id, 'AUTHENTICATED_SESSION'::text AS author_attribution,
      'APP'::text AS source_kind, a.recorded_at, a.received_at, d.updated_at AS draft_updated_at, j.attempts INTO v_source
    FROM public.voice_draft_notes d JOIN private.app_voice_task_recordings a ON a.draft_id = d.id
    JOIN public.voice_app_report_jobs j ON j.draft_id = d.id JOIN public.residents r ON r.id = d.resident_id
    WHERE d.id = p_draft_id AND d.status = 'PROCESSED' AND j.token = p_token AND j.completed_at IS NULL
      AND r.archived_at IS NULL AND d.updated_at IS NOT NULL AND d.created_at = a.received_at
      AND a.received_at >= now() - interval '30 days'
      AND a.transcript_sha256 = sha256(convert_to(d.transcript, 'UTF8'))
    FOR UPDATE OF j;
  END IF;
  IF NOT FOUND OR NOT public.has_org_feature(v_source.organization_id, 'module_voice_and_reports')
    OR NOT public.has_org_feature(v_source.organization_id, 'module_shift_tasks') THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT shift_definition_id, shift_date INTO v_shift, v_date
    FROM private.voice_shift_at(v_source.organization_id, v_source.recorded_at);
  IF v_shift IS NULL THEN RETURN '[]'::jsonb; END IF;

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
    ) ON CONFLICT (task_id, source_kind, source_id, fragment_index) DO UPDATE
    SET author_id = EXCLUDED.author_id, author_attribution = EXCLUDED.author_attribution,
      task_updated_at = EXCLUDED.task_updated_at, kind = EXCLUDED.kind, quote = EXCLUDED.quote
    WHERE shift_task_voice_suggestions.decision IS NULL
      AND (shift_task_voice_suggestions.author_id, shift_task_voice_suggestions.author_attribution,
        shift_task_voice_suggestions.task_updated_at)
      IS DISTINCT FROM (EXCLUDED.author_id, EXCLUDED.author_attribution, EXCLUDED.task_updated_at);
  END LOOP;
  RETURN jsonb_build_object(
    'queue_delay_ms', GREATEST(0, floor(extract(epoch FROM clock_timestamp() - v_source.received_at) * 1000)),
    'retry_count', GREATEST(0, v_source.attempts - 1)
  );
END $$;

NOTIFY pgrst, 'reload schema';
