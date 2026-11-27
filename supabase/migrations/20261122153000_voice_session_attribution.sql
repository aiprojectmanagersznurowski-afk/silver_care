-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: SEC-AUDIT-APPEND-ONLY
-- @REQ: ORG-ISOLATION

ALTER TABLE public.voice_captures
  ADD COLUMN declared_author_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT voice_declared_author_from_session_start
    CHECK (declared_author_id IS NULL OR (source = 'DEVICE' AND session_seq = 1));

CREATE FUNCTION public.read_voice_capture_context(p_capture_id uuid, p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_capture public.voice_captures;
BEGIN
  PERFORM private.require_report_service();
  SELECT * INTO v_capture FROM public.voice_captures
  WHERE id = p_capture_id AND status = 'TRANSCRIBING' AND processing_token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_CAPTURE_LEASE_EXPIRED' USING ERRCODE = '23514'; END IF;
  RETURN jsonb_build_object(
    'residents', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'firstName', r.first_name,
      'lastName', r.last_name, 'room', loc.room, 'bed', loc.bed)), '[]'::jsonb)
      FROM public.residents r LEFT JOIN LATERAL (
        SELECT rm.number::text AS room, b.label AS bed
        FROM public.bed_assignments a JOIN public.beds b ON b.id = a.bed_id
        JOIN public.rooms rm ON rm.id = b.room_id AND rm.organization_id = v_capture.organization_id
        WHERE a.resident_id = r.id AND v_capture.clock_state <> 'UNKNOWN'
          AND a.assigned_at <= v_capture.recorded_at
          AND (a.unassigned_at IS NULL OR a.unassigned_at > v_capture.recorded_at)
        ORDER BY a.assigned_at DESC, a.id LIMIT 1
      ) loc ON true WHERE r.organization_id = v_capture.organization_id
      AND (r.archived_at IS NULL OR r.archived_at > v_capture.recorded_at)),
    'staff', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', u.id,
      'name', btrim(u.raw_user_meta_data->>'full_name'))), '[]'::jsonb)
      FROM auth.users u WHERE u.raw_app_meta_data->>'organization_id' = v_capture.organization_id::text
      AND u.raw_app_meta_data->>'role' IN ('nurse', 'org_admin')
      AND u.raw_app_meta_data->>'is_active' IS DISTINCT FROM 'false'
      AND COALESCE(btrim(u.raw_user_meta_data->>'full_name'), '') <> ''),
    'declared_author_id', (SELECT c.declared_author_id FROM public.voice_captures c
      WHERE c.device_id = v_capture.device_id AND c.session_id = v_capture.session_id AND c.session_seq = 1)
  );
END $$;

CREATE FUNCTION private.apply_voice_session_declaration(p_device uuid, p_session uuid, p_capture uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_start public.voice_captures; v_row record; v_remaining text[];
  v_resident uuid; v_scope text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device::text || '/' || p_session::text, 0));
  SELECT * INTO v_start FROM public.voice_captures
    WHERE device_id = p_device AND session_id = p_session AND session_seq = 1;
  IF v_start.declared_author_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = v_start.declared_author_id
      AND raw_app_meta_data->>'organization_id' = v_start.organization_id::text
      AND raw_app_meta_data->>'role' IN ('nurse', 'org_admin')
      AND raw_app_meta_data->>'is_active' IS DISTINCT FROM 'false'
  ) THEN RETURN; END IF;
  FOR v_row IN SELECT q.* FROM public.voice_assignment_queue q
    JOIN public.voice_segments s ON s.id = q.segment_id
    JOIN public.voice_captures c ON c.id = s.capture_id
    WHERE c.device_id = p_device AND c.session_id = p_session AND c.session_seq > 1
      AND (p_capture IS NULL OR c.id = p_capture) AND q.decided_at IS NULL
      AND s.author_attribution = 'UNKNOWN' AND 'NO_AUTHOR' = ANY(q.reasons)
      AND NOT ('CONFLICTING_EVIDENCE' = ANY(q.reasons))
    ORDER BY q.segment_id FOR UPDATE OF q LOOP
    v_remaining := array_remove(v_row.reasons, 'NO_AUTHOR');
    v_scope := 'PENDING'; v_resident := NULL;
    IF cardinality(v_remaining) = 0 THEN
      IF cardinality(v_row.candidates) = 0 THEN
        v_scope := 'FACILITY';
      ELSIF cardinality(v_row.candidates) = 1 AND EXISTS (
        SELECT 1 FROM public.residents WHERE id = v_row.candidates[1] AND organization_id = v_start.organization_id
      ) THEN
        v_scope := 'RESIDENT'; v_resident := v_row.candidates[1];
      ELSE
        v_remaining := ARRAY['NO_MATCH'];
      END IF;
    END IF;
    UPDATE public.voice_segments SET author_id = v_start.declared_author_id, author_attribution = 'DECLARED_SESSION',
      assignment_status = v_scope, resident_id = v_resident WHERE id = v_row.segment_id;
    IF v_scope = 'PENDING' THEN
      UPDATE public.voice_assignment_queue SET reasons = v_remaining WHERE segment_id = v_row.segment_id;
    ELSE
      DELETE FROM public.voice_assignment_queue WHERE segment_id = v_row.segment_id;
    END IF;
    INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
    VALUES (v_start.organization_id, v_resident, 'VOICE_SEGMENT_AUTHOR_DECLARED',
      jsonb_build_object('segment_id', v_row.segment_id, 'scope', v_scope,
        'declaration_capture_id', v_start.id, 'author_id', v_start.declared_author_id));
  END LOOP;
END $$;

CREATE FUNCTION public.declare_voice_capture_author(p_capture_id uuid, p_token uuid, p_author_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_start public.voice_captures;
BEGIN
  PERFORM private.require_report_service();
  SELECT * INTO v_start FROM public.voice_captures WHERE id = p_capture_id AND source = 'DEVICE' AND session_seq = 1
    AND status = 'TRANSCRIBING' AND processing_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_CAPTURE_LEASE_EXPIRED' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_author_id
    AND raw_app_meta_data->>'organization_id' = v_start.organization_id::text
    AND raw_app_meta_data->>'role' IN ('nurse', 'org_admin')
    AND raw_app_meta_data->>'is_active' IS DISTINCT FROM 'false') THEN
    RAISE EXCEPTION 'INVALID_VOICE_DECLARATION' USING ERRCODE = '22023';
  END IF;
  IF v_start.declared_author_id IS NULL THEN
    UPDATE public.voice_captures SET declared_author_id = p_author_id WHERE id = p_capture_id;
    INSERT INTO public.audit_logs (organization_id, action, payload)
    VALUES (v_start.organization_id, 'VOICE_SESSION_AUTHOR_DECLARED',
      jsonb_build_object('capture_id', v_start.id, 'device_id', v_start.device_id,
        'session_id', v_start.session_id, 'author_id', p_author_id, 'recorded_at', v_start.recorded_at));
  ELSIF v_start.declared_author_id <> p_author_id THEN
    RAISE EXCEPTION 'CONFLICTING_VOICE_DECLARATION' USING ERRCODE = '23514';
  END IF;
  PERFORM private.apply_voice_session_declaration(v_start.device_id, v_start.session_id);
END $$;

CREATE FUNCTION private.reconcile_finalized_voice_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.apply_voice_session_declaration(NEW.device_id, NEW.session_id, NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER reconcile_finalized_voice_capture AFTER UPDATE OF status ON public.voice_captures
  FOR EACH ROW WHEN (NEW.status = 'SEGMENTED' AND NEW.source = 'DEVICE' AND NEW.session_seq > 1)
  EXECUTE FUNCTION private.reconcile_finalized_voice_capture();

REVOKE ALL ON FUNCTION private.apply_voice_session_declaration(uuid,uuid,uuid),
  private.reconcile_finalized_voice_capture(), public.read_voice_capture_context(uuid,uuid),
  public.declare_voice_capture_author(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_voice_capture_context(uuid,uuid),
  public.declare_voice_capture_author(uuid,uuid,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
