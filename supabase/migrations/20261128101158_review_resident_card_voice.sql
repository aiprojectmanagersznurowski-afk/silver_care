-- @REQ: VOICE-ZERO-GUESSING
-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: VOICE-RETENTION
-- @REQ: SEC-MFA-STAFF
-- @REQ: ORG-ISOLATION

-- APP captures retain the identity selected at capture, including after review or a split.
CREATE FUNCTION private.guard_selected_voice_segment() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.voice_captures c
    WHERE c.id = NEW.capture_id AND c.organization_id = NEW.organization_id AND c.source = 'APP'
      AND (NEW.author_id IS DISTINCT FROM c.author_id OR NEW.author_attribution <> 'AUTHENTICATED_SESSION'
        OR NEW.assignment_status = 'FACILITY'
        OR (NEW.assignment_status = 'RESIDENT' AND NEW.resident_id IS DISTINCT FROM c.selected_resident_id))
  ) THEN
    RAISE EXCEPTION 'VOICE_SELECTED_ASSIGNMENT_REQUIRED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION private.guard_selected_voice_segment() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER voice_segments_keep_selected_assignment
  BEFORE INSERT OR UPDATE OF capture_id, organization_id, assignment_status, resident_id, author_id, author_attribution
  ON public.voice_segments FOR EACH ROW EXECUTE FUNCTION private.guard_selected_voice_segment();

CREATE OR REPLACE FUNCTION private.lock_voice_review_capture(p_segment_id uuid) RETURNS public.voice_captures
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_org uuid := public.get_jwt_organization_id(); v_capture public.voice_captures;
BEGIN
  PERFORM private.require_report_staff(v_org, ARRAY['org_admin', 'nurse'], true);
  SELECT c.* INTO v_capture FROM public.voice_captures c
    JOIN public.voice_segments s ON s.capture_id = c.id AND s.organization_id = c.organization_id
    LEFT JOIN public.voice_retention_settings r ON r.organization_id = c.organization_id
    WHERE s.id = p_segment_id AND c.organization_id = v_org AND c.source IN ('APP', 'APP_GENERAL', 'DEVICE')
      AND c.status = 'SEGMENTED'
      AND c.received_at >= now() - make_interval(days => COALESCE(r.retention_days, 30))
    FOR SHARE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_SEGMENT_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  RETURN v_capture;
END $$;

CREATE OR REPLACE FUNCTION public.can_play_voice_segment(p_segment_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND public.staff_mfa_satisfied()
    AND EXISTS (
      SELECT 1 FROM public.voice_assignment_queue q
      JOIN public.voice_segments s ON s.id = q.segment_id AND s.organization_id = q.organization_id
      JOIN public.voice_captures c ON c.id = s.capture_id AND c.organization_id = q.organization_id
      LEFT JOIN public.voice_retention_settings r ON r.organization_id = q.organization_id
      WHERE q.segment_id = p_segment_id AND q.organization_id = public.get_jwt_organization_id()
        AND q.decided_at IS NULL AND s.assignment_status = 'PENDING' AND c.status = 'SEGMENTED'
        AND c.source IN ('APP', 'APP_GENERAL', 'DEVICE')
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

CREATE OR REPLACE FUNCTION public.claim_voice_segment_transcription(p_segment_id uuid DEFAULT NULL)
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
    'selected_resident_id', v_capture.selected_resident_id,
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

CREATE OR REPLACE FUNCTION public.expire_voice_captures() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_count integer;
  v_path text;
BEGIN
  PERFORM private.require_report_service();
  PERFORM private.expire_voice_device_uploads();
  WITH expired AS (
    SELECT c.id FROM public.voice_captures c LEFT JOIN public.voice_retention_settings r USING (organization_id)
    WHERE c.received_at < now() - make_interval(days => COALESCE(r.retention_days, 30))
      AND (c.status <> 'TRANSCRIBING' OR c.processing_started_at < now() - interval '10 minutes')
    ORDER BY c.received_at, c.id LIMIT 50 FOR UPDATE OF c SKIP LOCKED
  )
  DELETE FROM public.voice_captures c USING expired WHERE c.id = expired.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  FOR v_path IN
    SELECT o.name FROM storage.objects o
    JOIN public.organizations org ON org.id::text = split_part(o.name, '/', 1)
    LEFT JOIN public.voice_retention_settings settings ON settings.organization_id = org.id
    WHERE o.bucket_id = 'voice-recordings'
      AND split_part(o.name, '/', 2) IN ('app_general', 'app')
      AND cardinality(string_to_array(o.name, '/')) = 4
      AND o.created_at < now() - make_interval(days => COALESCE(settings.retention_days, 30))
      AND NOT EXISTS (SELECT 1 FROM public.voice_captures c WHERE c.storage_path = o.name)
      AND NOT EXISTS (SELECT 1 FROM public.voice_storage_deletions d WHERE d.path = o.name)
    ORDER BY o.created_at, o.name LIMIT 50
  LOOP
    IF pg_try_advisory_xact_lock(hashtextextended(v_path, 1205))
      AND NOT EXISTS (SELECT 1 FROM public.voice_captures c WHERE c.storage_path = v_path) THEN
      INSERT INTO public.voice_storage_deletions (path) VALUES (v_path) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  WITH expired_drafts AS (
    SELECT d.id FROM public.voice_draft_notes d
    JOIN public.residents r ON r.id = d.resident_id
    LEFT JOIN public.voice_retention_settings settings ON settings.organization_id = r.organization_id
    WHERE d.created_at < now() - make_interval(days => COALESCE(settings.retention_days, 30))
    ORDER BY d.created_at, d.id LIMIT 50 FOR UPDATE OF d SKIP LOCKED
  )
  DELETE FROM public.voice_draft_notes d USING expired_drafts expired WHERE d.id = expired.id;
  RETURN v_count;
END $$;

NOTIFY pgrst, 'reload schema';
