-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: SEC-MFA-STAFF
-- @REQ: SEC-AUDIT-APPEND-ONLY
-- @REQ: ORG-ISOLATION

ALTER TABLE public.voice_segments
  ADD COLUMN corrected_at timestamptz,
  ADD COLUMN event_occurred_at timestamptz;
ALTER TABLE public.voice_assignment_queue
  ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK (version >= 0);
CREATE INDEX voice_assignment_queue_page ON public.voice_assignment_queue (organization_id, created_at, segment_id)
  WHERE decided_at IS NULL;

CREATE TABLE private.voice_review_decisions (
  segment_id uuid NOT NULL REFERENCES public.voice_segments (id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  input jsonb NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (segment_id, request_id)
);
REVOKE ALL ON private.voice_review_decisions FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.bump_voice_review_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END $$;
CREATE TRIGGER bump_voice_review_version BEFORE UPDATE ON public.voice_assignment_queue
  FOR EACH ROW EXECUTE FUNCTION private.bump_voice_review_version();

CREATE FUNCTION private.voice_shift_at(p_org uuid, p_at timestamptz)
RETURNS TABLE (shift_definition_id uuid, shift_date date)
LANGUAGE sql STABLE SET search_path = '' AS $$
  -- SHIFT_POLICY.timezone; dla zmiany nocnej obowiązuje data jej rozpoczęcia.
  SELECT candidate.id, candidate.local_date FROM (
    SELECT d.id, CASE WHEN d.crosses_midnight AND t.local_time::time < d.end_time
      THEN t.local_time::date - 1 ELSE t.local_time::date END AS local_date,
      count(*) OVER () AS match_count
    FROM public.shift_definitions d CROSS JOIN LATERAL (SELECT p_at AT TIME ZONE 'Europe/Warsaw' AS local_time) t
    WHERE d.organization_id = p_org AND d.is_active
      AND CASE WHEN d.crosses_midnight THEN t.local_time::time >= d.start_time OR t.local_time::time < d.end_time
        ELSE t.local_time::time >= d.start_time AND t.local_time::time < d.end_time END
  ) candidate WHERE candidate.match_count = 1;
$$;

CREATE FUNCTION private.lock_voice_review_capture(p_segment_id uuid) RETURNS public.voice_captures
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_org uuid := public.get_jwt_organization_id(); v_capture public.voice_captures;
BEGIN
  PERFORM private.require_report_staff(v_org, ARRAY['org_admin', 'nurse'], true);
  SELECT c.* INTO v_capture FROM public.voice_captures c
    JOIN public.voice_segments s ON s.capture_id = c.id AND s.organization_id = c.organization_id
    LEFT JOIN public.voice_retention_settings r ON r.organization_id = c.organization_id
    WHERE s.id = p_segment_id AND c.organization_id = v_org AND c.source IN ('APP_GENERAL', 'DEVICE')
      AND c.status = 'SEGMENTED'
      AND c.received_at >= now() - make_interval(days => COALESCE(r.retention_days, 30))
    FOR SHARE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_SEGMENT_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  RETURN v_capture;
END $$;

CREATE FUNCTION private.replay_voice_review(p_segment_id uuid, p_request_id uuid, p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_decision private.voice_review_decisions; v_queue public.voice_assignment_queue;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_ID_REQUIRED' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_decision FROM private.voice_review_decisions WHERE segment_id = p_segment_id AND request_id = p_request_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_decision.actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'VOICE_SEGMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF auth.jwt()->'app_metadata'->>'role' = 'nurse' THEN
    SELECT * INTO v_queue FROM public.voice_assignment_queue WHERE segment_id = p_segment_id;
    IF NOT COALESCE(public.is_shift_lead(
      COALESCE(v_queue.shift_definition_id, (v_decision.result->>'shift_definition_id')::uuid),
      COALESCE(v_queue.shift_date, (v_decision.result->>'shift_date')::date)), false) THEN
      RAISE EXCEPTION 'VOICE_SEGMENT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF v_decision.input IS DISTINCT FROM p_input THEN
    RAISE EXCEPTION 'VOICE_REVIEW_CONFLICT' USING ERRCODE = 'PT409';
  END IF;
  RETURN v_decision.result;
END $$;

CREATE FUNCTION private.assert_voice_review_version(p_queue public.voice_assignment_queue, p_expected_version integer)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF p_queue.segment_id IS NULL OR (auth.jwt()->'app_metadata'->>'role' = 'nurse'
    AND NOT COALESCE(public.is_shift_lead(p_queue.shift_definition_id, p_queue.shift_date), false)) THEN
    RAISE EXCEPTION 'VOICE_SEGMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_queue.decided_at IS NOT NULL OR p_expected_version IS DISTINCT FROM p_queue.version THEN
    RAISE EXCEPTION 'VOICE_REVIEW_CONFLICT' USING ERRCODE = 'PT409';
  END IF;
END $$;

CREATE FUNCTION public.correct_voice_segment_time(
  p_segment_id uuid, p_expected_version integer, p_request_id uuid, p_mode text, p_basis text,
  p_local_start timestamp DEFAULT NULL, p_utc_offset_minutes integer DEFAULT NULL,
  p_shift_definition_id uuid DEFAULT NULL, p_shift_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_capture public.voice_captures; v_segment public.voice_segments; v_queue public.voice_assignment_queue;
  v_at timestamptz; v_shift uuid; v_date date; v_reasons text[]; v_version integer;
  v_scope text := 'PENDING'; v_resident uuid;
  v_input jsonb := jsonb_build_array('time', p_expected_version, p_mode, p_basis, p_local_start,
    p_utc_offset_minutes, p_shift_definition_id, p_shift_date);
  v_result jsonb;
BEGIN
  v_capture := private.lock_voice_review_capture(p_segment_id);
  SELECT * INTO v_queue FROM public.voice_assignment_queue WHERE segment_id = p_segment_id FOR UPDATE;
  v_result := private.replay_voice_review(p_segment_id, p_request_id, v_input);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  PERFORM private.assert_voice_review_version(v_queue, p_expected_version);
  SELECT * INTO STRICT v_segment FROM public.voice_segments WHERE id = p_segment_id FOR UPDATE;
  IF v_segment.assignment_status <> 'PENDING' THEN RAISE EXCEPTION 'VOICE_REVIEW_CONFLICT' USING ERRCODE = 'PT409'; END IF;
  IF p_basis IS NULL OR p_basis NOT IN ('ROSTER_VERIFIED', 'SOURCE_VERIFIED', 'STAFF_CONFIRMED') THEN
    RAISE EXCEPTION 'VOICE_TIME_BASIS_INVALID' USING ERRCODE = '22023';
  END IF;

  v_reasons := v_queue.reasons;
  IF p_mode = 'VERIFIED_START' AND p_shift_definition_id IS NULL AND p_shift_date IS NULL
    AND p_local_start IS NOT NULL AND isfinite(p_local_start) AND p_utc_offset_minutes BETWEEN -840 AND 840 THEN
    v_at := (p_local_start - make_interval(mins => p_utc_offset_minutes)) AT TIME ZONE 'UTC';
    IF v_at AT TIME ZONE 'Europe/Warsaw' IS DISTINCT FROM p_local_start
      OR v_at + make_interval(secs => (v_segment.end_ms - v_segment.start_ms) / 1000.0) > v_capture.received_at THEN
      RAISE EXCEPTION 'VOICE_LOCAL_TIME_INVALID' USING ERRCODE = '22023';
    END IF;
    SELECT shift_definition_id, shift_date INTO v_shift, v_date FROM private.voice_shift_at(v_capture.organization_id, v_at);
    v_reasons := array_remove(v_reasons, 'TIME_UNCERTAIN');
  ELSIF p_mode = 'SHIFT_ONLY' AND p_local_start IS NULL AND p_utc_offset_minutes IS NULL
    AND p_shift_date IS NOT NULL AND isfinite(p_shift_date) THEN
    SELECT id, p_shift_date INTO v_shift, v_date FROM public.shift_definitions
      WHERE id = p_shift_definition_id AND organization_id = v_capture.organization_id AND is_active
        AND ((p_shift_date + start_time) AT TIME ZONE 'Europe/Warsaw') <= v_capture.received_at;
    IF NOT ('TIME_UNCERTAIN' = ANY(v_reasons)) THEN v_reasons := array_append(v_reasons, 'TIME_UNCERTAIN'); END IF;
  ELSE
    RAISE EXCEPTION 'VOICE_TIME_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  IF v_shift IS NULL THEN RAISE EXCEPTION 'VOICE_SHIFT_NOT_UNIQUE' USING ERRCODE = '22023'; END IF;
  IF (v_shift, v_date) IS DISTINCT FROM (v_queue.shift_definition_id, v_queue.shift_date)
    AND auth.jwt()->'app_metadata'->>'role' <> 'org_admin' THEN
    RAISE EXCEPTION 'VOICE_SHIFT_TRANSFER_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF cardinality(v_reasons) = 0 THEN
    IF v_segment.author_id IS NULL THEN
      v_reasons := ARRAY['NO_AUTHOR'];
    ELSIF v_segment.transcript_path IS NULL THEN
      v_reasons := ARRAY['NO_MATCH'];
    ELSIF cardinality(v_queue.candidates) = 0 THEN
      v_scope := 'FACILITY';
    ELSIF cardinality(v_queue.candidates) = 1 AND EXISTS (
      SELECT 1 FROM public.residents WHERE id = v_queue.candidates[1]
        AND organization_id = v_capture.organization_id AND archived_at IS NULL
    ) THEN
      v_scope := 'RESIDENT'; v_resident := v_queue.candidates[1];
    ELSE
      v_reasons := ARRAY['NO_MATCH'];
    END IF;
  END IF;
  UPDATE public.voice_segments SET corrected_at = v_at, assignment_status = v_scope, resident_id = v_resident
    WHERE id = p_segment_id;
  UPDATE public.voice_assignment_queue SET shift_definition_id = v_shift, shift_date = v_date,
    reasons = CASE WHEN v_scope = 'PENDING' THEN v_reasons ELSE reasons END,
    decided_at = CASE WHEN v_scope <> 'PENDING' THEN now() END,
    decided_by = CASE WHEN v_scope <> 'PENDING' THEN auth.uid() END
    WHERE segment_id = p_segment_id RETURNING version INTO v_version;
  v_result := jsonb_build_object('segment_id', p_segment_id, 'version', v_version, 'corrected_at', v_at,
    'shift_definition_id', v_shift, 'shift_date', v_date, 'reasons', v_reasons, 'closed', v_scope <> 'PENDING');
  INSERT INTO private.voice_review_decisions VALUES (p_segment_id, p_request_id, auth.uid(), v_input, v_result);
  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
    VALUES (v_capture.organization_id, v_resident, 'VOICE_SEGMENT_TIME_CORRECTED', auth.uid(),
      v_result || jsonb_build_object('capture_id', v_capture.id, 'mode', p_mode, 'basis', p_basis,
        'recorded_at', v_capture.recorded_at, 'clock_state', v_capture.clock_state, 'received_at', v_capture.received_at,
        'previous_corrected_at', v_segment.corrected_at, 'event_occurred_at', v_segment.event_occurred_at,
        'previous_shift_definition_id', v_queue.shift_definition_id, 'previous_shift_date', v_queue.shift_date,
        'start_ms', v_segment.start_ms, 'end_ms', v_segment.end_ms));
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION private.bump_voice_review_version(), private.voice_shift_at(uuid,timestamptz),
  private.lock_voice_review_capture(uuid), private.replay_voice_review(uuid,uuid,jsonb),
  private.assert_voice_review_version(public.voice_assignment_queue,integer),
  public.correct_voice_segment_time(uuid,integer,uuid,text,text,timestamp,integer,uuid,date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.correct_voice_segment_time(uuid,integer,uuid,text,text,timestamp,integer,uuid,date)
  TO authenticated;
NOTIFY pgrst, 'reload schema';
