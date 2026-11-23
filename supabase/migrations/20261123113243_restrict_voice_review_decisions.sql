-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: SEC-MFA-STAFF
-- @REQ: ORG-ISOLATION

CREATE FUNCTION public.can_play_voice_segment(p_segment_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND auth.jwt()->>'aal' = 'aal2' AND COALESCE(public.check_mfa_requirement(), false)
    AND EXISTS (
      SELECT 1 FROM public.voice_assignment_queue q
      JOIN public.voice_segments s ON s.id = q.segment_id AND s.organization_id = q.organization_id
      JOIN public.voice_captures c ON c.id = s.capture_id AND c.organization_id = q.organization_id
      LEFT JOIN public.voice_retention_settings r ON r.organization_id = q.organization_id
      WHERE q.segment_id = p_segment_id AND q.organization_id = public.get_jwt_organization_id()
        AND q.decided_at IS NULL AND s.assignment_status = 'PENDING' AND c.status = 'SEGMENTED'
        AND c.source IN ('APP_GENERAL', 'DEVICE')
        AND c.received_at >= now() - make_interval(days => COALESCE(r.retention_days, 30))
        AND public.has_org_feature(q.organization_id, 'module_voice_and_reports')
        AND CASE auth.jwt()->'app_metadata'->>'role'
          WHEN 'org_admin' THEN true
          WHEN 'nurse' THEN public.is_shift_lead(q.shift_definition_id, q.shift_date)
          ELSE false END
        AND EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'voice-recordings' AND name = c.storage_path)
        AND NOT EXISTS (SELECT 1 FROM public.voice_storage_deletions WHERE path = c.storage_path)
    );
$$;

CREATE FUNCTION private.review_voice_segment_scope(
  p_segment_id uuid, p_expected_version integer, p_request_id uuid, p_scope text, p_resident_id uuid, p_author_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_capture public.voice_captures; v_queue public.voice_assignment_queue; v_old public.voice_segments;
  v_author uuid; v_attribution text; v_version integer; v_result jsonb;
  v_input jsonb := jsonb_build_array('scope', p_expected_version, p_scope, p_resident_id, p_author_id);
BEGIN
  v_capture := private.lock_voice_review_capture(p_segment_id);
  SELECT * INTO v_queue FROM public.voice_assignment_queue WHERE segment_id = p_segment_id FOR UPDATE;
  IF p_request_id IS NOT NULL THEN
    v_result := private.replay_voice_review(p_segment_id, p_request_id, v_input);
    IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  END IF;
  PERFORM private.assert_voice_review_version(v_queue, p_expected_version);
  IF p_scope IS NULL OR p_scope NOT IN ('RESIDENT', 'FACILITY', 'UNASSIGNABLE')
    OR (p_scope = 'RESIDENT') <> (p_resident_id IS NOT NULL) THEN
    RAISE EXCEPTION 'INVALID_VOICE_SEGMENT_SCOPE' USING ERRCODE = '22023';
  END IF;
  IF p_scope <> 'UNASSIGNABLE' AND v_queue.reasons && ARRAY['TIME_UNCERTAIN', 'MIXED_SEGMENT']::text[] THEN
    RAISE EXCEPTION 'VOICE_SEGMENT_SOURCE_REVIEW_REQUIRED' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO STRICT v_old FROM public.voice_segments WHERE id = p_segment_id FOR UPDATE;
  IF v_old.assignment_status <> 'PENDING' THEN RAISE EXCEPTION 'VOICE_REVIEW_CONFLICT' USING ERRCODE = 'PT409'; END IF;
  IF p_scope <> 'UNASSIGNABLE' AND v_old.transcript_path IS NULL THEN
    RAISE EXCEPTION 'VOICE_AUDIO_UNAVAILABLE' USING ERRCODE = '22023';
  END IF;
  v_author := COALESCE(p_author_id, v_old.author_id);
  IF v_author IS NULL AND p_scope <> 'UNASSIGNABLE' THEN
    RAISE EXCEPTION 'VOICE_SEGMENT_AUTHOR_REQUIRED' USING ERRCODE = '22023';
  END IF;
  v_attribution := CASE WHEN p_author_id IS NULL THEN v_old.author_attribution ELSE 'MANUAL_SEGMENT_CORRECTION' END;
  UPDATE public.voice_segments SET assignment_status = p_scope, resident_id = p_resident_id,
    author_id = v_author, author_attribution = v_attribution, transcription_token = NULL,
    transcription_status = CASE WHEN p_scope = 'UNASSIGNABLE' AND transcription_status IN ('WAITING', 'PROCESSING')
      THEN 'UNAVAILABLE' ELSE transcription_status END WHERE id = p_segment_id;
  UPDATE public.voice_assignment_queue SET decided_at = pg_catalog.now(), decided_by = auth.uid()
    WHERE segment_id = p_segment_id RETURNING version INTO v_version;
  v_result := jsonb_build_object('segment_id', p_segment_id, 'version', v_version, 'closed', true);
  IF p_request_id IS NOT NULL THEN
    INSERT INTO private.voice_review_decisions VALUES (p_segment_id, p_request_id, auth.uid(), v_input, v_result);
  END IF;
  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
  VALUES (v_capture.organization_id, p_resident_id, 'VOICE_SEGMENT_RESOLVED', auth.uid(),
    jsonb_build_object('segment_id', p_segment_id, 'capture_id', v_capture.id, 'method', 'MANUAL', 'scope', p_scope,
      'previous_resident_id', v_old.resident_id, 'previous_author_id', v_old.author_id,
      'author_id', v_author, 'author_attribution', v_attribution));
  RETURN v_result;
END $$;

CREATE FUNCTION public.review_voice_segment_scope(
  p_segment_id uuid, p_expected_version integer, p_request_id uuid, p_scope text,
  p_resident_id uuid DEFAULT NULL, p_author_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_ID_REQUIRED' USING ERRCODE = '22023'; END IF;
  RETURN private.review_voice_segment_scope(p_segment_id, p_expected_version, p_request_id, p_scope, p_resident_id, p_author_id);
END $$;

-- Kompatybilność z formularzem otwartym przed wdrożeniem, wyłącznie dla niezmienionej pozycji.
CREATE OR REPLACE FUNCTION public.resolve_voice_segment(
  p_segment_id uuid, p_scope text, p_resident_id uuid DEFAULT NULL, p_author_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
  SELECT (private.review_voice_segment_scope(p_segment_id, 0, NULL, p_scope, p_resident_id, p_author_id)->>'segment_id')::uuid;
$$;

REVOKE ALL ON FUNCTION private.review_voice_segment_scope(uuid,integer,uuid,text,uuid,uuid),
  public.review_voice_segment_scope(uuid,integer,uuid,text,uuid,uuid), public.can_play_voice_segment(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_voice_segment_scope(uuid,integer,uuid,text,uuid,uuid),
  public.can_play_voice_segment(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
