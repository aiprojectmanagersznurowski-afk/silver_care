-- @REQ: VOICE-DOCK-REPORTS
-- @REQ: VOICE-MEDICAL-STRIP
-- @REQ: VOICE-DRAFT-ISOLATION
-- @REQ: REPORT-APPROVAL

ALTER TABLE public.voice_segments
  ADD COLUMN projection_status text NOT NULL DEFAULT 'WAITING'
    CHECK (projection_status IN ('WAITING', 'PROCESSING', 'READY', 'FAILED')),
  ADD COLUMN projection_token uuid,
  ADD COLUMN projection_attempted_at timestamptz,
  ADD COLUMN projection_attempts integer NOT NULL DEFAULT 0;
CREATE INDEX voice_segments_projection_work ON public.voice_segments (projection_attempted_at, id)
  WHERE assignment_status IN ('RESIDENT','FACILITY') AND projection_status IN ('WAITING','PROCESSING');

CREATE TABLE public.voice_segment_proposals (
  segment_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  capture_id uuid NOT NULL,
  resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL,
  time_state text NOT NULL,
  behavioral_facts text[] NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (resident_id IS NOT NULL OR cardinality(behavioral_facts) = 0)
);
CREATE INDEX voice_segment_proposals_review ON public.voice_segment_proposals (organization_id, recorded_at);
CREATE INDEX voice_segment_proposals_resident ON public.voice_segment_proposals (resident_id, recorded_at)
  WHERE resident_id IS NOT NULL;
ALTER TABLE public.voice_segment_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voice_segment_proposals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.voice_segment_proposals TO authenticated, service_role;

CREATE POLICY voice_segment_proposals_staff ON public.voice_segment_proposals FOR SELECT TO authenticated USING (
  organization_id = (SELECT public.get_jwt_organization_id())
  AND public.has_org_feature(organization_id, 'module_voice_and_reports')
  AND (SELECT auth.jwt())->>'aal' = 'aal2' AND (SELECT public.check_mfa_requirement())
  AND ((SELECT auth.jwt())->'app_metadata'->>'role' = 'org_admin'
    OR ((SELECT auth.jwt())->'app_metadata'->>'role' = 'nurse' AND author_id = (SELECT auth.uid())))
);

CREATE FUNCTION public.claim_voice_segment_projection(p_segment_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_segment public.voice_segments; v_capture public.voice_captures;
BEGIN
  PERFORM private.require_report_service();
  SELECT s.* INTO v_segment FROM public.voice_segments s JOIN public.voice_captures c ON c.id = s.capture_id
    WHERE (p_segment_id IS NULL OR s.id = p_segment_id) AND c.status = 'SEGMENTED'
    AND s.assignment_status IN ('RESIDENT','FACILITY') AND s.transcript_path IS NOT NULL
    AND ((s.projection_status = 'WAITING' AND (s.projection_attempted_at IS NULL
      OR s.projection_attempted_at < now() - interval '3 minutes'))
      OR (s.projection_status = 'PROCESSING' AND s.projection_attempted_at < now() - interval '10 minutes'))
    AND public.has_org_feature(s.organization_id, 'module_voice_and_reports')
    ORDER BY s.projection_attempted_at NULLS FIRST, c.received_at, s.id LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_segment.projection_attempts >= 5 THEN
    UPDATE public.voice_segments SET projection_status = 'FAILED', projection_token = NULL WHERE id = v_segment.id;
    RETURN NULL;
  END IF;
  UPDATE public.voice_segments SET projection_status = 'PROCESSING', projection_token = gen_random_uuid(),
    projection_attempted_at = now(), projection_attempts = projection_attempts + 1
    WHERE id = v_segment.id RETURNING * INTO v_segment;
  SELECT * INTO STRICT v_capture FROM public.voice_captures WHERE id = v_segment.capture_id;
  RETURN jsonb_build_object('segment_id', v_segment.id, 'organization_id', v_segment.organization_id,
    'token', v_segment.projection_token, 'resident_id', v_segment.resident_id, 'author_id', v_segment.author_id,
    'scope', lower(v_segment.assignment_status), 'source', v_capture.source, 'transcript_path', v_segment.transcript_path,
    'registry', jsonb_build_object(
      'residentNames', (SELECT COALESCE(jsonb_agg(name), '[]'::jsonb) FROM (
        SELECT concat_ws(' ', first_name, last_name) AS name FROM public.residents WHERE organization_id = v_segment.organization_id
        UNION SELECT raw_user_meta_data->>'full_name' FROM auth.users
          WHERE raw_app_meta_data->>'organization_id' = v_segment.organization_id::text
          AND raw_user_meta_data->>'full_name' IS NOT NULL
      ) names),
      'rooms', (SELECT COALESCE(jsonb_agg(DISTINCT r.number::text), '[]'::jsonb)
        FROM public.rooms r WHERE r.organization_id = v_segment.organization_id),
      'beds', (SELECT COALESCE(jsonb_agg(DISTINCT b.label), '[]'::jsonb) FROM public.beds b
        JOIN public.rooms r ON r.id = b.room_id WHERE r.organization_id = v_segment.organization_id)
    ));
END $$;

CREATE FUNCTION public.complete_voice_segment_projection(p_segment_id uuid, p_token uuid, p_result jsonb)
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
  UPDATE public.voice_segments SET projection_status = 'READY', projection_token = NULL WHERE id = p_segment_id;
  INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
    VALUES (v_segment.organization_id, v_segment.resident_id, 'VOICE_SEGMENT_PROJECTED',
      jsonb_build_object('segment_id', p_segment_id, 'capture_id', v_capture.id, 'author_id', v_segment.author_id));
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.claim_voice_segment_projection(uuid), public.complete_voice_segment_projection(uuid,uuid,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_voice_segment_projection(uuid), public.complete_voice_segment_projection(uuid,uuid,jsonb)
  TO service_role;
NOTIFY pgrst, 'reload schema';
