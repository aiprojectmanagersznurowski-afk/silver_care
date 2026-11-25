-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: VOICE-RETENTION
-- @REQ: SEC-AUDIT-APPEND-ONLY
ALTER TABLE public.voice_segments
  ADD CONSTRAINT voice_segments_id_capture_key UNIQUE (id, capture_id),
  ADD COLUMN parent_segment_id uuid,
  ADD COLUMN derived_start_at timestamptz,
  ADD COLUMN transcription_status text CHECK (transcription_status IN ('WAITING', 'PROCESSING', 'READY', 'UNAVAILABLE')),
  ADD COLUMN transcription_token uuid,
  ADD COLUMN transcription_queue_version integer,
  ADD COLUMN transcription_started_at timestamptz,
  ADD COLUMN transcription_attempts integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT voice_segment_parent_source FOREIGN KEY (parent_segment_id, capture_id)
    REFERENCES public.voice_segments (id, capture_id) ON DELETE CASCADE,
  ADD CONSTRAINT voice_segment_parent_distinct CHECK (parent_segment_id IS DISTINCT FROM id),
  DROP CONSTRAINT voice_segments_assignment_status_check,
  ADD CONSTRAINT voice_segments_assignment_status_check
    CHECK (assignment_status IN ('PENDING', 'RESIDENT', 'FACILITY', 'UNASSIGNABLE', 'SPLIT'));
CREATE INDEX voice_segments_parent ON public.voice_segments (parent_segment_id, capture_id)
  WHERE parent_segment_id IS NOT NULL;
CREATE INDEX voice_segment_transcription_pending ON public.voice_segments (transcription_started_at, id)
  WHERE transcription_status IN ('WAITING', 'PROCESSING') AND assignment_status = 'PENDING';

CREATE OR REPLACE FUNCTION private.voice_segment_effective_at(p_segment public.voice_segments, p_capture public.voice_captures)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(p_segment.corrected_at, p_segment.derived_start_at,
    CASE WHEN p_segment.parent_segment_id IS NULL AND p_capture.clock_state <> 'UNKNOWN' THEN p_capture.recorded_at END)
$$;

CREATE FUNCTION public.split_voice_segment(p_segment_id uuid, p_expected_version integer, p_request_id uuid, p_parts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_capture public.voice_captures; v_segment public.voice_segments; v_queue public.voice_assignment_queue;
  v_input jsonb := jsonb_build_array('split', p_expected_version, p_parts);
  v_result jsonb; v_children jsonb := '[]'::jsonb; v_part record; v_previous_end integer; v_id uuid;
  v_ordinal integer; v_version integer; v_parent_start timestamptz; v_at timestamptz;
  v_shift uuid; v_date date; v_reasons text[];
BEGIN
  v_capture := private.lock_voice_review_capture(p_segment_id);
  -- Każdy zapis dziecka używa wspólnego licznika kolejności tego pliku.
  PERFORM pg_advisory_xact_lock(hashtextextended('voice_split:' || v_capture.id, 0));
  SELECT * INTO v_queue FROM public.voice_assignment_queue WHERE segment_id = p_segment_id FOR UPDATE;
  v_result := private.replay_voice_review(p_segment_id, p_request_id, v_input);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  PERFORM private.assert_voice_review_version(v_queue, p_expected_version);
  SELECT * INTO STRICT v_segment FROM public.voice_segments WHERE id = p_segment_id FOR UPDATE;
  IF v_segment.assignment_status <> 'PENDING' OR NOT ('MIXED_SEGMENT' = ANY(v_queue.reasons)) THEN
    RAISE EXCEPTION 'VOICE_SEGMENT_NOT_MIXED' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'voice-recordings' AND name = v_capture.storage_path)
    OR EXISTS (SELECT 1 FROM public.voice_storage_deletions WHERE path = v_capture.storage_path) THEN
    RAISE EXCEPTION 'VOICE_AUDIO_UNAVAILABLE' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_parts) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'VOICE_SPLIT_INVALID' USING ERRCODE = '22023'; END IF;
  IF jsonb_array_length(p_parts) NOT BETWEEN 2 AND 12 THEN RAISE EXCEPTION 'VOICE_SPLIT_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT max(ordinal) INTO v_ordinal FROM public.voice_segments WHERE capture_id = v_capture.id;
  v_previous_end := v_segment.start_ms;
  IF NOT ('TIME_UNCERTAIN' = ANY(v_queue.reasons)) THEN
    v_parent_start := COALESCE(v_segment.corrected_at, v_segment.derived_start_at,
      CASE WHEN v_capture.clock_state <> 'UNKNOWN' THEN v_capture.recorded_at + v_segment.start_ms * interval '1 millisecond' END);
  END IF;

  FOR v_part IN SELECT * FROM jsonb_to_recordset(p_parts) AS p(start_ms integer, end_ms integer, excluded boolean)
    ORDER BY start_ms, end_ms
  LOOP
    IF v_part.start_ms IS NULL OR v_part.end_ms IS NULL OR v_part.start_ms < v_previous_end
      OR v_part.end_ms <= v_part.start_ms OR v_part.end_ms > v_segment.end_ms THEN
      RAISE EXCEPTION 'VOICE_SPLIT_BOUNDS_INVALID' USING ERRCODE = '22023';
    END IF;
    v_previous_end := v_part.end_ms;
    v_ordinal := v_ordinal + 1;
    v_at := v_parent_start + (v_part.start_ms - v_segment.start_ms) * interval '1 millisecond';
    IF v_at IS NULL THEN
      v_shift := v_queue.shift_definition_id; v_date := v_queue.shift_date;
    ELSE
      SELECT shift_definition_id, shift_date INTO v_shift, v_date FROM private.voice_shift_at(v_capture.organization_id, v_at);
    END IF;
    IF NOT COALESCE(v_part.excluded, false)
      AND auth.jwt()->'app_metadata'->>'role' = 'nurse'
      AND (v_shift, v_date) IS DISTINCT FROM (v_queue.shift_definition_id, v_queue.shift_date) THEN
      RAISE EXCEPTION 'VOICE_SHIFT_TRANSFER_FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.voice_segments (organization_id, capture_id, ordinal, start_ms, end_ms, parent_segment_id,
      corrected_at, derived_start_at, assignment_status, author_id, author_attribution, transcription_status)
    VALUES (v_capture.organization_id, v_capture.id, v_ordinal, v_part.start_ms, v_part.end_ms, v_segment.id,
      CASE WHEN v_segment.corrected_at IS NOT NULL THEN v_at END,
      CASE WHEN v_segment.corrected_at IS NULL THEN v_at END,
      CASE WHEN v_part.excluded THEN 'UNASSIGNABLE' ELSE 'PENDING' END,
      v_segment.author_id, v_segment.author_attribution, CASE WHEN NOT COALESCE(v_part.excluded, false) THEN 'WAITING' END)
    RETURNING id INTO v_id;

    IF NOT COALESCE(v_part.excluded, false) THEN
      v_reasons := ARRAY['NO_MATCH'];
      IF v_at IS NULL OR v_shift IS NULL THEN v_reasons := array_append(v_reasons, 'TIME_UNCERTAIN'); END IF;
      IF v_segment.author_id IS NULL THEN v_reasons := array_append(v_reasons, 'NO_AUTHOR'); END IF;
      INSERT INTO public.voice_assignment_queue (organization_id, segment_id, shift_definition_id, shift_date, reasons)
        VALUES (v_capture.organization_id, v_id, v_shift, v_date, v_reasons);
    END IF;
    v_children := v_children || jsonb_build_array(jsonb_build_object('segment_id', v_id, 'start_ms', v_part.start_ms,
      'end_ms', v_part.end_ms, 'excluded', COALESCE(v_part.excluded, false), 'start_at', v_at,
      'shift_definition_id', v_shift, 'shift_date', v_date));
  END LOOP;

  UPDATE public.voice_segments SET assignment_status = 'SPLIT', projection_token = NULL,
    transcription_token = NULL WHERE id = p_segment_id;
  UPDATE public.voice_assignment_queue SET decided_at = now(), decided_by = auth.uid()
    WHERE segment_id = p_segment_id RETURNING version INTO v_version;
  v_result := jsonb_build_object('segment_id', p_segment_id, 'version', v_version, 'children', v_children, 'closed', true);
  INSERT INTO private.voice_review_decisions VALUES (p_segment_id, p_request_id, auth.uid(), v_input, v_result);
  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
    VALUES (v_capture.organization_id, 'VOICE_SEGMENT_SPLIT', auth.uid(), v_result || jsonb_build_object(
      'capture_id', v_capture.id, 'recorded_at', v_capture.recorded_at, 'received_at', v_capture.received_at,
      'clock_state', v_capture.clock_state, 'corrected_at', v_segment.corrected_at,
      'event_occurred_at', v_segment.event_occurred_at, 'start_ms', v_segment.start_ms, 'end_ms', v_segment.end_ms,
      'shift_definition_id', v_queue.shift_definition_id, 'shift_date', v_queue.shift_date));
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.split_voice_segment(uuid,integer,uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.split_voice_segment(uuid,integer,uuid,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
