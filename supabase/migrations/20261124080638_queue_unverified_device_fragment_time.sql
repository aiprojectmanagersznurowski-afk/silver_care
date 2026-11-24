-- @REQ: NUR-SHIFT-CLOSURE
-- @REQ: VOICE-RESIDENT-ASSIGN
CREATE OR REPLACE FUNCTION public.finalize_voice_capture(p_capture_id uuid, p_token uuid, p_segments jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_capture public.voice_captures; v_segment record; v_id uuid; v_author uuid;
  v_shift uuid; v_shift_date date; v_start timestamptz; v_count integer := 0;
  v_scope text; v_attribution text; v_reasons text[];
BEGIN
  PERFORM private.require_report_service();
  SELECT * INTO v_capture FROM public.voice_captures WHERE id = p_capture_id
    AND status = 'TRANSCRIBING' AND processing_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_CAPTURE_LEASE_EXPIRED' USING ERRCODE = '23514'; END IF;
  IF jsonb_typeof(p_segments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'INVALID_VOICE_SEGMENTS' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_segments) > 250 THEN
    RAISE EXCEPTION 'INVALID_VOICE_SEGMENTS' USING ERRCODE = '22023';
  END IF;
  FOR v_segment IN SELECT * FROM jsonb_to_recordset(p_segments) AS p(
    ordinal integer, start_ms integer, end_ms integer, transcript_path text,
    scope text, resident_id uuid, author_id uuid, reasons text[], candidate_ids uuid[]
  ) ORDER BY ordinal LOOP
    v_author := COALESCE(v_capture.author_id, v_segment.author_id);
    v_attribution := CASE WHEN v_capture.author_id IS NOT NULL THEN 'AUTHENTICATED_SESSION'
      WHEN v_author IS NULL THEN 'UNKNOWN' ELSE 'DECLARED_SESSION' END;
    v_start := private.voice_capture_offset_at(v_capture, v_segment.start_ms);
    v_reasons := COALESCE(v_segment.reasons, ARRAY[]::text[]);
    IF v_start IS NULL AND NOT ('TIME_UNCERTAIN' = ANY(v_reasons)) THEN
      v_reasons := array_append(v_reasons, 'TIME_UNCERTAIN');
    END IF;
    v_scope := CASE WHEN cardinality(v_reasons) > 0 THEN 'PENDING' ELSE v_segment.scope END;
    IF v_scope IS NULL OR v_segment.transcript_path IS NULL
      OR (v_scope = 'PENDING' AND cardinality(v_reasons) = 0) THEN
      RAISE EXCEPTION 'INVALID_VOICE_SEGMENTS' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.voice_segments
      (organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path, derived_start_at,
       assignment_status, resident_id, author_id, author_attribution)
    VALUES (v_capture.organization_id, p_capture_id, v_segment.ordinal, v_segment.start_ms, v_segment.end_ms,
      v_segment.transcript_path, v_start, v_scope, v_segment.resident_id, v_author, v_attribution)
    RETURNING id INTO v_id;

    IF v_scope = 'PENDING' THEN
      SELECT shift_definition_id, shift_date INTO v_shift, v_shift_date
      FROM private.voice_shift_at(v_capture.organization_id, v_start);
      INSERT INTO public.voice_assignment_queue
        (organization_id, segment_id, shift_definition_id, shift_date, reasons, candidates)
      VALUES (v_capture.organization_id, v_id, v_shift, v_shift_date, v_reasons,
        COALESCE(v_segment.candidate_ids, '{}'));
    ELSE
      INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
      VALUES (v_capture.organization_id, v_segment.resident_id, 'VOICE_SEGMENT_ASSIGNED',
        jsonb_build_object('segment_id', v_id, 'method', 'REGISTRY_MATCH', 'scope', v_scope,
          'author_id', v_author, 'author_attribution', v_attribution));
    END IF;
    v_count := v_count + 1;
  END LOOP;
  UPDATE public.voice_captures SET status = 'SEGMENTED', processing_token = NULL, processing_started_at = NULL
    WHERE id = p_capture_id;
  RETURN v_count;
END $$;
