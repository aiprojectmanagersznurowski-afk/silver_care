-- @REQ: NUR-TASKS-VOICE-COMPLETION
-- @REQ: VOICE-ZERO-GUESSING
-- @REQ: VOICE-RETENTION

-- APP evidence can come from a selected private capture or a legacy draft.
ALTER TABLE public.shift_task_voice_suggestions
  DROP CONSTRAINT shift_task_voice_suggestions_check,
  ADD CONSTRAINT shift_task_voice_suggestions_source_reference_check
  CHECK ((source_kind <> 'APP' OR resident_id IS NOT NULL) AND
    CASE WHEN draft_id IS NOT NULL THEN source_kind = 'APP'
      AND source_id = draft_id AND segment_id IS NULL AND draft_updated_at IS NOT NULL
    ELSE segment_id IS NOT NULL AND source_id = segment_id AND draft_updated_at IS NULL END);

CREATE OR REPLACE FUNCTION private.shift_task_voice_source_current(p_evidence public.shift_task_voice_suggestions)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_evidence.draft_id IS NOT NULL THEN EXISTS (
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
      AND (c.source <> 'APP' OR s.resident_id = c.selected_resident_id)
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
      AND ((c.source IN ('APP', 'APP_GENERAL') AND s.author_attribution = 'AUTHENTICATED_SESSION' AND s.author_id = c.author_id)
        OR (c.source = 'DEVICE' AND s.author_attribution IN ('DECLARED_SESSION','MANUAL_SEGMENT_CORRECTION')))
      AND (c.source <> 'APP' OR s.resident_id = c.selected_resident_id)
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
