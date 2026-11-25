-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: VOICE-RETENTION
-- @REQ: VOICE-MEDICAL-STRIP

CREATE FUNCTION public.claim_voice_segment_transcription(p_segment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_segment public.voice_segments; v_capture public.voice_captures; v_at timestamptz;
BEGIN
  PERFORM private.require_report_service();
  SELECT s.* INTO v_segment FROM public.voice_segments s
    JOIN public.voice_captures c ON c.id = s.capture_id
    JOIN public.voice_assignment_queue q ON q.segment_id = s.id AND q.decided_at IS NULL
    LEFT JOIN public.voice_retention_settings r ON r.organization_id = s.organization_id
    WHERE (p_segment_id IS NULL OR s.id = p_segment_id) AND s.assignment_status = 'PENDING'
      AND c.status = 'SEGMENTED' AND s.parent_segment_id IS NOT NULL
      AND c.received_at >= now() - make_interval(days => COALESCE(r.retention_days, 30))
      AND public.has_org_feature(s.organization_id, 'module_voice_and_reports')
      AND ((s.transcription_status = 'WAITING' AND (s.transcription_started_at IS NULL
        OR s.transcription_started_at < now() - interval '3 minutes'))
        OR (s.transcription_status = 'PROCESSING' AND s.transcription_started_at < now() - interval '10 minutes'))
    ORDER BY s.transcription_started_at NULLS FIRST, c.received_at, s.id LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_segment.transcription_attempts >= 5 THEN
    UPDATE public.voice_segments SET transcription_status = 'UNAVAILABLE', transcription_token = NULL WHERE id = v_segment.id;
    RETURN NULL;
  END IF;
  UPDATE public.voice_segments SET transcription_status = 'PROCESSING', transcription_token = gen_random_uuid(),
    transcription_started_at = now(), transcription_attempts = transcription_attempts + 1,
    transcription_queue_version = (SELECT version FROM public.voice_assignment_queue WHERE segment_id = v_segment.id)
    WHERE id = v_segment.id RETURNING * INTO v_segment;
  SELECT * INTO STRICT v_capture FROM public.voice_captures WHERE id = v_segment.capture_id;
  IF NOT EXISTS (SELECT 1 FROM public.voice_assignment_queue WHERE segment_id = v_segment.id
    AND 'TIME_UNCERTAIN' = ANY(reasons)) THEN v_at := private.voice_segment_effective_at(v_segment, v_capture); END IF;

  RETURN jsonb_build_object('segment_id', v_segment.id, 'capture_id', v_capture.id, 'organization_id', v_segment.organization_id,
    'storage_path', v_capture.storage_path, 'sha256', v_capture.sha256, 'token', v_segment.transcription_token,
    'start_ms', v_segment.start_ms, 'end_ms', v_segment.end_ms, 'time_certain', v_at IS NOT NULL, 'author_id', v_segment.author_id,
    'residents', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'firstName', r.first_name,
      'lastName', r.last_name, 'room', loc.room, 'bed', loc.bed)), '[]'::jsonb)
      FROM public.residents r LEFT JOIN LATERAL (
        SELECT rm.number::text AS room, b.label AS bed FROM public.bed_assignments a
        JOIN public.beds b ON b.id = a.bed_id JOIN public.rooms rm ON rm.id = b.room_id
        WHERE a.resident_id = r.id AND rm.organization_id = v_segment.organization_id AND v_at IS NOT NULL
          AND a.assigned_at <= v_at AND (a.unassigned_at IS NULL OR a.unassigned_at > v_at)
        ORDER BY a.assigned_at DESC, a.id LIMIT 1
      ) loc ON true WHERE r.organization_id = v_segment.organization_id AND r.archived_at IS NULL));
END $$;

CREATE FUNCTION public.finish_voice_segment_transcription(
  p_segment_id uuid, p_token uuid, p_result jsonb DEFAULT NULL, p_unavailable boolean DEFAULT false
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_segment public.voice_segments; v_capture public.voice_captures; v_queue public.voice_assignment_queue;
  v_reasons text[]; v_candidates uuid[]; v_scope text; v_resident uuid; v_path text; v_expected_path text;
BEGIN
  PERFORM private.require_report_service();
  SELECT c.* INTO v_capture FROM public.voice_captures c JOIN public.voice_segments s ON s.capture_id = c.id
    WHERE s.id = p_segment_id FOR SHARE OF c;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO v_queue FROM public.voice_assignment_queue WHERE segment_id = p_segment_id AND decided_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO v_segment FROM public.voice_segments WHERE id = p_segment_id AND assignment_status = 'PENDING'
    AND transcription_status = 'PROCESSING' AND transcription_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_segment.transcription_queue_version IS DISTINCT FROM v_queue.version THEN
    UPDATE public.voice_segments SET transcription_status = 'WAITING', transcription_token = NULL,
      transcription_started_at = NULL, transcription_attempts = transcription_attempts - 1
      WHERE id = p_segment_id;
    RETURN false;
  END IF;
  IF NOT public.has_org_feature(v_segment.organization_id, 'module_voice_and_reports') THEN p_result := NULL; END IF;
  IF p_result IS NULL THEN
    UPDATE public.voice_segments SET transcription_status = CASE WHEN p_unavailable OR transcription_attempts >= 5
      THEN 'UNAVAILABLE' ELSE 'WAITING' END, transcription_token = NULL WHERE id = p_segment_id;
    RETURN true;
  END IF;
  IF jsonb_typeof(p_result) <> 'object' OR length(p_result::text) > 16000 THEN
    RAISE EXCEPTION 'VOICE_TRANSCRIPTION_RESULT_INVALID' USING ERRCODE = '22023';
  END IF;

  v_expected_path := concat(v_segment.organization_id, '/transcripts/', v_capture.id, '/', v_segment.id, '/', p_token);
  SELECT result.transcript_path, result.scope, result.resident_id,
    COALESCE(result.reasons, '{}'), COALESCE(result.candidate_ids, '{}')
  INTO v_path, v_scope, v_resident, v_reasons, v_candidates
  FROM jsonb_to_record(p_result) AS result(transcript_path text, scope text, resident_id uuid, reasons text[], candidate_ids uuid[]);
  IF v_path IS DISTINCT FROM v_expected_path OR v_scope NOT IN ('PENDING', 'RESIDENT', 'FACILITY') OR v_scope IS NULL THEN
    RAISE EXCEPTION 'VOICE_TRANSCRIPTION_RESULT_INVALID' USING ERRCODE = '22023';
  END IF;

  v_reasons := array_remove(array_remove(v_reasons, 'NO_AUTHOR'), 'TIME_UNCERTAIN');
  IF v_segment.author_id IS NULL THEN v_reasons := array_append(v_reasons, 'NO_AUTHOR'); END IF;
  IF 'TIME_UNCERTAIN' = ANY(v_queue.reasons) THEN v_reasons := array_append(v_reasons, 'TIME_UNCERTAIN'); END IF;
  IF cardinality(v_reasons) = 0 AND v_scope = 'PENDING' THEN
    CASE cardinality(v_candidates)
      WHEN 0 THEN v_scope := 'FACILITY';
      WHEN 1 THEN v_scope := 'RESIDENT'; v_resident := v_candidates[1];
      ELSE v_reasons := ARRAY['MULTIPLE_MATCHES'];
    END CASE;
  END IF;
  IF cardinality(v_reasons) > 0 THEN v_scope := 'PENDING'; END IF;
  IF v_scope <> 'RESIDENT' THEN v_resident := NULL; END IF;

  UPDATE public.voice_segments SET transcript_path = v_path, transcription_status = 'READY', transcription_token = NULL,
    assignment_status = v_scope, resident_id = v_resident WHERE id = p_segment_id;
  IF v_scope = 'PENDING' THEN
    UPDATE public.voice_assignment_queue SET reasons = v_reasons, candidates = v_candidates WHERE segment_id = p_segment_id;
  ELSE
    DELETE FROM public.voice_assignment_queue WHERE segment_id = p_segment_id;
    INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
      VALUES (v_segment.organization_id, v_resident, 'VOICE_SEGMENT_ASSIGNED',
        jsonb_build_object('segment_id', p_segment_id, 'parent_segment_id', v_segment.parent_segment_id,
          'capture_id', v_segment.capture_id, 'scope', v_scope, 'method', 'REGISTRY_MATCH', 'author_id', v_segment.author_id));
  END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.claim_voice_segment_transcription(uuid),
  public.finish_voice_segment_transcription(uuid,uuid,jsonb,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_voice_segment_transcription(uuid),
  public.finish_voice_segment_transcription(uuid,uuid,jsonb,boolean) TO service_role;
NOTIFY pgrst, 'reload schema';
