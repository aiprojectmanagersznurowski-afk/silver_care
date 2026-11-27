-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: SEC-MFA-STAFF

CREATE OR REPLACE FUNCTION public.resolve_voice_segment(
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
  IF p_scope <> 'UNASSIGNABLE' AND v_queue.reasons && ARRAY['TIME_UNCERTAIN', 'MIXED_SEGMENT']::text[] THEN
    RAISE EXCEPTION 'VOICE_SEGMENT_SOURCE_REVIEW_REQUIRED' USING ERRCODE = '23514';
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
