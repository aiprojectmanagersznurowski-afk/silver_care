-- @REQ: NUR-TASKS
-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: SEC-AUDIT-APPEND-ONLY

CREATE UNIQUE INDEX shift_tasks_voice_segment_retry ON public.shift_tasks
  (organization_id, shift_definition_id, shift_date, source_ref, source_quote)
  WHERE source = 'HANDOVER' AND source_ref LIKE 'voice-segment/%';

CREATE FUNCTION private.project_voice_shift_tasks(
  p_segment public.voice_segments, p_capture public.voice_captures, p_tasks jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_local timestamp; v_shift uuid; v_date date; v_candidates integer; v_intent record; v_task uuid;
BEGIN
  IF p_tasks IS NULL OR p_capture.clock_state = 'UNKNOWN'
    OR NOT public.has_org_feature(p_segment.organization_id, 'module_shift_tasks') THEN RETURN; END IF;
  IF jsonb_typeof(p_tasks) <> 'array' OR jsonb_array_length(p_tasks) > 6 THEN
    RAISE EXCEPTION 'INVALID_VOICE_TASKS_PAYLOAD' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_tasks) = 0 THEN RETURN; END IF;

  v_local := p_capture.recorded_at AT TIME ZONE 'Europe/Warsaw';
  WITH candidates AS (
    SELECT s.id, d.day, dense_rank() OVER (ORDER BY d.day + s.start_time) AS position
    FROM public.shift_definitions s CROSS JOIN (VALUES ((v_local::date)), ((v_local::date + 1))) d(day)
    WHERE s.organization_id = p_segment.organization_id AND s.is_active AND d.day + s.start_time > v_local
  )
  SELECT id, day, count(*) OVER () INTO v_shift, v_date, v_candidates
    FROM candidates WHERE position = 1 ORDER BY id LIMIT 1;
  IF v_candidates IS DISTINCT FROM 1 THEN RETURN; END IF;

  FOR v_intent IN SELECT * FROM jsonb_to_recordset(p_tasks) AS t(title text, quote text) LOOP
    IF v_intent.title IS NULL OR length(btrim(v_intent.title)) NOT BETWEEN 1 AND 300
      OR v_intent.quote IS NULL OR length(v_intent.quote) > 420 OR position(v_intent.title IN v_intent.quote) = 0 THEN
      RAISE EXCEPTION 'INVALID_VOICE_TASK_EVIDENCE' USING ERRCODE = '22023';
    END IF;
    PERFORM private.assert_no_org_registry_identifiers(p_segment.organization_id, v_intent.quote);
    v_task := NULL;
    INSERT INTO public.shift_tasks
      (organization_id, shift_definition_id, shift_date, resident_id, title, source, source_ref, source_quote, status, created_by)
      VALUES (p_segment.organization_id, v_shift, v_date, p_segment.resident_id, btrim(v_intent.title), 'HANDOVER',
        'voice-segment/' || p_segment.id, v_intent.quote, 'PROPOSED', p_segment.author_id)
      ON CONFLICT DO NOTHING RETURNING id INTO v_task;
    IF v_task IS NOT NULL THEN
      INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
        VALUES (p_segment.organization_id, p_segment.resident_id, 'VOICE_SHIFT_TASK_PROPOSED',
          jsonb_build_object('task_id', v_task, 'segment_id', p_segment.id, 'capture_id', p_capture.id,
            'author_id', p_segment.author_id, 'shift_definition_id', v_shift, 'shift_date', v_date));
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION private.project_voice_shift_tasks(public.voice_segments,public.voice_captures,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

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

NOTIFY pgrst, 'reload schema';
