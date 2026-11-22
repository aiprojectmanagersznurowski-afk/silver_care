-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: SEC-AUDIT-APPEND-ONLY
-- @REQ: ORG-ISOLATION

ALTER TABLE public.voice_captures
  ADD COLUMN processing_token uuid,
  ADD COLUMN processing_started_at timestamptz,
  ADD COLUMN processing_attempts integer NOT NULL DEFAULT 0;
CREATE INDEX voice_captures_processing ON public.voice_captures (received_at, id)
  WHERE status IN ('RECEIVED', 'TRANSCRIBING');

CREATE FUNCTION public.claim_voice_capture(p_capture_id uuid DEFAULT NULL)
RETURNS SETOF public.voice_captures
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  PERFORM private.require_report_service();
  RETURN QUERY
  WITH candidate AS (
    SELECT id FROM public.voice_captures
    WHERE (p_capture_id IS NULL OR id = p_capture_id)
      AND processing_attempts < 5
      AND (status = 'RECEIVED' OR (status = 'TRANSCRIBING'
        AND processing_started_at < pg_catalog.now() - interval '10 minutes'))
      AND public.has_org_feature(organization_id, 'module_voice_and_reports')
    ORDER BY received_at, id LIMIT 1 FOR UPDATE SKIP LOCKED
  )
  UPDATE public.voice_captures c SET
    status = 'TRANSCRIBING', processing_started_at = pg_catalog.now(),
    processing_token = pg_catalog.gen_random_uuid(), processing_attempts = processing_attempts + 1
  FROM candidate d WHERE c.id = d.id RETURNING c.*;
END $$;

CREATE FUNCTION public.complete_voice_capture_failure(p_capture_id uuid, p_token uuid, p_retry boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  PERFORM private.require_report_service();
  UPDATE public.voice_captures SET
    status = CASE WHEN p_retry AND processing_attempts < 5 THEN 'RECEIVED' ELSE 'FAILED' END,
    processing_token = NULL, processing_started_at = NULL
  WHERE id = p_capture_id AND status = 'TRANSCRIBING' AND processing_token = p_token;
  RETURN FOUND;
END $$;

CREATE FUNCTION public.finalize_voice_capture(p_capture_id uuid, p_token uuid, p_segments jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_capture public.voice_captures; v_segment record; v_id uuid; v_author uuid;
  v_shift uuid; v_shift_date date; v_local timestamp; v_count integer := 0;
  v_scope text; v_attribution text;
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
  IF v_capture.clock_state <> 'UNKNOWN' THEN
    v_local := v_capture.recorded_at AT TIME ZONE 'Europe/Warsaw';
    SELECT id, CASE WHEN crosses_midnight AND v_local::time < end_time
      THEN v_local::date - 1 ELSE v_local::date END INTO v_shift, v_shift_date
    FROM public.shift_definitions WHERE organization_id = v_capture.organization_id AND is_active
      AND CASE WHEN crosses_midnight THEN v_local::time >= start_time OR v_local::time < end_time
        ELSE v_local::time >= start_time AND v_local::time < end_time END
    ORDER BY id LIMIT 1;
  END IF;
  FOR v_segment IN SELECT * FROM jsonb_to_recordset(p_segments) AS p(
    ordinal integer, start_ms integer, end_ms integer, transcript_path text,
    scope text, resident_id uuid, author_id uuid, reasons text[], candidate_ids uuid[]
  ) ORDER BY ordinal LOOP
    v_author := COALESCE(v_capture.author_id, v_segment.author_id);
    v_attribution := CASE WHEN v_capture.author_id IS NOT NULL THEN 'AUTHENTICATED_SESSION'
      WHEN v_author IS NULL THEN 'UNKNOWN' ELSE 'DECLARED_SESSION' END;
    v_scope := CASE WHEN cardinality(v_segment.reasons) > 0 THEN 'PENDING' ELSE v_segment.scope END;
    IF v_scope IS NULL OR v_segment.transcript_path IS NULL
      OR (v_scope = 'PENDING' AND COALESCE(cardinality(v_segment.reasons), 0) = 0) THEN
      RAISE EXCEPTION 'INVALID_VOICE_SEGMENTS' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.voice_segments
      (organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path,
       assignment_status, resident_id, author_id, author_attribution)
    VALUES (v_capture.organization_id, p_capture_id, v_segment.ordinal, v_segment.start_ms, v_segment.end_ms,
      v_segment.transcript_path, v_scope, v_segment.resident_id, v_author, v_attribution)
    RETURNING id INTO v_id;

    IF v_scope = 'PENDING' THEN
      INSERT INTO public.voice_assignment_queue
        (organization_id, segment_id, shift_definition_id, shift_date, reasons, candidates)
      VALUES (v_capture.organization_id, v_id, v_shift, v_shift_date, v_segment.reasons,
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

CREATE FUNCTION public.resolve_voice_segment(
  p_segment_id uuid, p_scope text, p_resident_id uuid DEFAULT NULL, p_author_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_queue public.voice_assignment_queue; v_old public.voice_segments;
  v_org uuid := public.get_jwt_organization_id(); v_author uuid; v_attribution text;
BEGIN
  PERFORM private.require_report_staff(v_org, ARRAY['org_admin', 'nurse'], true);
  SELECT * INTO v_queue FROM public.voice_assignment_queue
    WHERE segment_id = p_segment_id AND organization_id = v_org AND decided_at IS NULL FOR UPDATE;
  IF v_queue.segment_id IS NULL OR ((auth.jwt()->'app_metadata'->>'role') = 'nurse'
    AND NOT COALESCE(public.is_shift_lead(v_queue.shift_definition_id, v_queue.shift_date), false)) THEN
    RAISE EXCEPTION 'VOICE_SEGMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_scope IS NULL OR p_scope NOT IN ('RESIDENT', 'FACILITY', 'UNASSIGNABLE')
    OR (p_scope = 'RESIDENT') <> (p_resident_id IS NOT NULL) THEN
    RAISE EXCEPTION 'INVALID_VOICE_SEGMENT_SCOPE' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_old FROM public.voice_segments WHERE id = p_segment_id FOR UPDATE;
  v_author := COALESCE(p_author_id, v_old.author_id);
  IF v_author IS NULL AND p_scope <> 'UNASSIGNABLE' THEN
    RAISE EXCEPTION 'VOICE_SEGMENT_AUTHOR_REQUIRED' USING ERRCODE = '22023';
  END IF;
  v_attribution := CASE WHEN p_author_id IS NULL THEN v_old.author_attribution ELSE 'MANUAL_SEGMENT_CORRECTION' END;
  UPDATE public.voice_segments SET assignment_status = p_scope, resident_id = p_resident_id,
    author_id = v_author, author_attribution = v_attribution WHERE id = p_segment_id;
  UPDATE public.voice_assignment_queue SET decided_at = pg_catalog.now(), decided_by = auth.uid()
    WHERE segment_id = p_segment_id;
  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
  VALUES (v_org, p_resident_id, 'VOICE_SEGMENT_RESOLVED', auth.uid(),
    jsonb_build_object('segment_id', p_segment_id, 'method', 'MANUAL', 'scope', p_scope,
      'previous_resident_id', v_old.resident_id, 'previous_author_id', v_old.author_id,
      'author_id', v_author, 'author_attribution', v_attribution));
  RETURN p_segment_id;
END $$;

REVOKE ALL ON FUNCTION public.claim_voice_capture(uuid), public.complete_voice_capture_failure(uuid,uuid,boolean),
  public.finalize_voice_capture(uuid,uuid,jsonb), public.resolve_voice_segment(uuid,text,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_voice_capture(uuid), public.complete_voice_capture_failure(uuid,uuid,boolean),
  public.finalize_voice_capture(uuid,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_voice_segment(uuid,text,uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
