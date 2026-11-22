-- @REQ: VOICE-DEVICE-INGEST
-- @REQ: ORG-ISOLATION

CREATE FUNCTION public.register_stored_device_capture(
  p_device_id uuid, p_source_key uuid, p_session_id uuid, p_session_seq integer,
  p_storage_path text, p_sha256 text, p_recorded_at timestamptz, p_clock_state text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_device public.voice_devices; v_capture public.voice_captures;
  v_clock_state text := p_clock_state; v_received_at timestamptz := statement_timestamp();
BEGIN
  PERFORM private.require_report_service();
  SELECT * INTO v_device FROM public.voice_devices WHERE id = p_device_id AND revoked_at IS NULL FOR SHARE;
  IF NOT FOUND OR NOT public.has_org_feature(v_device.organization_id, 'module_voice_and_reports') THEN
    RAISE EXCEPTION 'VOICE_DEVICE_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;
  IF p_source_key IS NULL OR p_session_id IS NULL OR p_session_seq IS NULL OR p_session_seq < 1
    OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' OR p_recorded_at IS NULL OR NOT isfinite(p_recorded_at)
    OR p_clock_state IS NULL OR p_clock_state NOT IN ('SYNCED', 'RELATIVE', 'UNKNOWN') THEN
    RAISE EXCEPTION 'INVALID_VOICE_CAPTURE_METADATA' USING ERRCODE = '22023';
  END IF;
  IF p_storage_path IS DISTINCT FROM
    concat(v_device.organization_id, '/device/', p_device_id, '/', p_source_key) THEN
    RAISE EXCEPTION 'INVALID_VOICE_STORAGE_PATH' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'voice-recordings' AND name = p_storage_path) THEN
    RAISE EXCEPTION 'VOICE_STORAGE_OBJECT_REQUIRED' USING ERRCODE = '23503';
  END IF;
  IF p_recorded_at > v_received_at OR (p_clock_state = 'SYNCED' AND v_device.last_sync_at IS NOT NULL
    AND p_recorded_at < v_device.last_sync_at - interval '24 hours') THEN
    v_clock_state := 'UNKNOWN';
  END IF;

  INSERT INTO public.voice_captures
    (organization_id, source, source_key, storage_path, sha256, device_id, session_id, session_seq,
     recorded_at, received_at, clock_state)
  VALUES (v_device.organization_id, 'DEVICE', p_source_key, p_storage_path, p_sha256, p_device_id,
    p_session_id, p_session_seq, p_recorded_at, v_received_at, v_clock_state)
  ON CONFLICT (device_id, source_key) WHERE source = 'DEVICE' DO NOTHING
  RETURNING * INTO v_capture;
  IF NOT FOUND THEN
    SELECT * INTO STRICT v_capture FROM public.voice_captures
      WHERE source = 'DEVICE' AND device_id = p_device_id AND source_key = p_source_key;
    IF v_capture.sha256 <> p_sha256 OR v_capture.session_id <> p_session_id
      OR v_capture.session_seq <> p_session_seq OR v_capture.recorded_at <> p_recorded_at THEN
      RAISE EXCEPTION 'CONFLICTING_VOICE_CAPTURE_RECEIPT' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN v_capture.id;
END $$;
REVOKE ALL ON FUNCTION public.register_stored_device_capture(uuid,uuid,uuid,integer,text,text,timestamptz,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_stored_device_capture(uuid,uuid,uuid,integer,text,text,timestamptz,text)
  TO service_role;
NOTIFY pgrst, 'reload schema';
