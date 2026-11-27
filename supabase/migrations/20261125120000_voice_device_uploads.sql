-- @REQ: VOICE-DEVICE-INGEST
-- @REQ: ORG-ISOLATION
-- @REQ: VOICE-RETENTION
CREATE TABLE private.voice_device_uploads (
  id uuid PRIMARY KEY,
  device_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  capture_id uuid NOT NULL,
  session_id uuid NOT NULL,
  session_seq integer NOT NULL CHECK (session_seq >= 1),
  recorded_at timestamptz NOT NULL,
  clock_state text NOT NULL CHECK (clock_state IN ('SYNCED', 'RELATIVE', 'UNKNOWN')),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  codec text NOT NULL,
  path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
-- Reservations outlive deletion of a device so its signed uploads still get cleaned up.
ALTER TABLE private.voice_device_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.voice_device_uploads FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX voice_device_uploads_capture ON private.voice_device_uploads (device_id, capture_id, created_at DESC);
CREATE INDEX voice_device_uploads_rate ON private.voice_device_uploads (device_id, created_at);
CREATE INDEX voice_device_uploads_expiry ON private.voice_device_uploads (expires_at, id);

CREATE FUNCTION public.prepare_voice_device_upload(
  p_token_hash text, p_capture_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_device public.voice_devices;
  v_attempt private.voice_device_uploads;
  v_receipt_hash text;
  v_now timestamptz := statement_timestamp();
  v_recorded_at timestamptz;
  v_clock_state text;
  v_age_ms bigint;
  v_id uuid;
BEGIN
  PERFORM private.require_report_service();
  SELECT * INTO v_device FROM public.voice_devices WHERE token_hash = p_token_hash AND revoked_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT public.has_org_feature(v_device.organization_id, 'module_voice_and_reports') THEN
    RETURN jsonb_build_object('status', 'DEVICE_REVOKED');
  END IF;
  IF p_capture_id IS NULL THEN RETURN jsonb_build_object('status', 'AUTHENTICATED'); END IF;
  SELECT sha256 INTO v_receipt_hash FROM public.voice_captures
    WHERE organization_id = v_device.organization_id AND device_id = v_device.id AND source_key = p_capture_id
      AND source = 'DEVICE';
  IF FOUND THEN RETURN jsonb_build_object('status', 'DUPLICATE', 'sha256', v_receipt_hash); END IF;

  SELECT * INTO v_attempt FROM private.voice_device_uploads
    WHERE organization_id = v_device.organization_id AND device_id = v_device.id AND capture_id = p_capture_id
      AND expires_at > v_now
    ORDER BY created_at DESC, id DESC LIMIT 1;
  IF p_metadata IS NULL THEN
    IF v_attempt.id IS NULL THEN RETURN jsonb_build_object('status', 'HASH_MISMATCH'); END IF;
  ELSE
    IF (SELECT count(*) FROM private.voice_device_uploads
        WHERE device_id = v_device.id AND created_at >= v_now - interval '1 minute') >= 60 THEN
      RETURN jsonb_build_object('status', 'RETRY_LATER');
    END IF;
    IF v_attempt.id IS NOT NULL AND (
      v_attempt.sha256 IS DISTINCT FROM p_metadata->>'sha256'
      OR v_attempt.size_bytes IS DISTINCT FROM (p_metadata->>'size_bytes')::integer
      OR v_attempt.codec IS DISTINCT FROM p_metadata->>'codec'
      OR v_attempt.session_id IS DISTINCT FROM (p_metadata->>'session_id')::uuid
      OR v_attempt.session_seq IS DISTINCT FROM (p_metadata->>'session_seq')::integer
    ) THEN RETURN jsonb_build_object('status', 'RETRY_LATER'); END IF;

    v_recorded_at := (p_metadata->>'recorded_at')::timestamptz;
    v_clock_state := p_metadata->>'clock_state';
    v_age_ms := (p_metadata->>'age_ms')::bigint;
    IF v_attempt.id IS NOT NULL THEN
      v_recorded_at := v_attempt.recorded_at;
      v_clock_state := v_attempt.clock_state;
    ELSIF v_clock_state = 'RELATIVE' THEN
      IF v_age_ms > extract(epoch FROM (v_now - '0001-01-01T00:00:00Z'::timestamptz)) * 1000 THEN
        v_clock_state := 'UNKNOWN';
      ELSE
        v_recorded_at := v_now - v_age_ms * interval '1 millisecond';
      END IF;
    END IF;
    IF v_recorded_at > v_now OR v_recorded_at < v_device.last_sync_at - interval '24 hours' THEN
      v_clock_state := 'UNKNOWN';
    END IF;

    v_id := gen_random_uuid();
    INSERT INTO private.voice_device_uploads (
      id, device_id, organization_id, capture_id, session_id, session_seq, recorded_at, clock_state,
      sha256, size_bytes, codec, path, created_at, expires_at
    ) VALUES (
      v_id, v_device.id, v_device.organization_id, p_capture_id, (p_metadata->>'session_id')::uuid,
      (p_metadata->>'session_seq')::integer, v_recorded_at, v_clock_state, p_metadata->>'sha256',
      (p_metadata->>'size_bytes')::integer, p_metadata->>'codec',
      concat(v_device.organization_id, '/device/', v_device.id, '/', p_capture_id, '/', v_id),
      -- Supabase signs uploads for two hours. Allow signing latency and in-flight writes before cleanup.
      v_now, v_now + interval '125 minutes'
    ) RETURNING * INTO v_attempt;
  END IF;
  RETURN jsonb_build_object(
    'status', 'PENDING', 'attempt_id', v_attempt.id, 'path', v_attempt.path, 'sha256', v_attempt.sha256,
    'size_bytes', v_attempt.size_bytes, 'codec', v_attempt.codec, 'recorded_at', v_attempt.recorded_at,
    'expires_at', v_attempt.expires_at
  );
END $$;

CREATE FUNCTION public.commit_voice_device_upload(
  p_token_hash text, p_capture_id uuid, p_attempt_id uuid, p_sha256 text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_device public.voice_devices;
  v_attempt private.voice_device_uploads;
  v_receipt_hash text;
BEGIN
  PERFORM private.require_report_service();
  SELECT * INTO v_device FROM public.voice_devices WHERE token_hash = p_token_hash AND revoked_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT public.has_org_feature(v_device.organization_id, 'module_voice_and_reports') THEN
    RETURN 'DEVICE_REVOKED';
  END IF;
  SELECT sha256 INTO v_receipt_hash FROM public.voice_captures
    WHERE organization_id = v_device.organization_id AND device_id = v_device.id AND source_key = p_capture_id
      AND source = 'DEVICE';
  IF FOUND THEN
    RETURN CASE WHEN v_receipt_hash = p_sha256 THEN 'DUPLICATE' ELSE 'HASH_MISMATCH' END;
  END IF;

  SELECT * INTO v_attempt FROM private.voice_device_uploads WHERE id = p_attempt_id
    AND organization_id = v_device.organization_id AND device_id = v_device.id AND capture_id = p_capture_id
    AND expires_at > statement_timestamp() AND sha256 = p_sha256 FOR UPDATE;
  IF NOT FOUND THEN RETURN 'HASH_MISMATCH'; END IF;
  PERFORM public.register_stored_device_capture(v_device.id, p_capture_id, v_attempt.session_id,
    v_attempt.session_seq, v_attempt.path, v_attempt.sha256, v_attempt.recorded_at, v_attempt.clock_state);
  UPDATE public.voice_devices SET last_sync_at = statement_timestamp() WHERE id = v_device.id;
  RETURN 'ACCEPTED';
END $$;

CREATE FUNCTION private.expire_voice_device_uploads() RETURNS void
LANGUAGE sql SET search_path = '' AS $$
  WITH expired AS (
    SELECT id FROM private.voice_device_uploads WHERE expires_at <= now()
    ORDER BY expires_at, id LIMIT 100 FOR UPDATE SKIP LOCKED
  ), removed AS (
    DELETE FROM private.voice_device_uploads u USING expired e WHERE u.id = e.id RETURNING u.path
  )
  INSERT INTO public.voice_storage_deletions (path)
    SELECT path FROM removed r WHERE NOT EXISTS (SELECT 1 FROM public.voice_captures c WHERE c.storage_path = r.path)
    ON CONFLICT (path) DO NOTHING;
$$;

CREATE FUNCTION private.queue_unreserved_device_upload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.voice_device_uploads WHERE path = NEW.name FOR KEY SHARE)
    AND NOT EXISTS (SELECT 1 FROM public.voice_captures WHERE storage_path = NEW.name) THEN
    INSERT INTO public.voice_storage_deletions (path) VALUES (NEW.name)
    ON CONFLICT (path) DO UPDATE SET queued_at = excluded.queued_at, lease_token = NULL, leased_until = NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER queue_unreserved_device_upload AFTER INSERT ON storage.objects FOR EACH ROW
  WHEN (NEW.bucket_id = 'voice-recordings' AND split_part(NEW.name, '/', 2) = 'device'
    AND split_part(NEW.name, '/', 5) <> '' AND split_part(NEW.name, '/', 6) = '')
  EXECUTE FUNCTION private.queue_unreserved_device_upload();

REVOKE ALL ON FUNCTION private.expire_voice_device_uploads(), private.queue_unreserved_device_upload(),
  public.prepare_voice_device_upload(text,uuid,jsonb), public.commit_voice_device_upload(text,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prepare_voice_device_upload(text,uuid,jsonb),
  public.commit_voice_device_upload(text,uuid,uuid,text) TO service_role;

-- Retain compatibility with existing callers of the storage intake RPC.
CREATE OR REPLACE FUNCTION public.register_stored_device_capture(
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
    concat(v_device.organization_id, '/device/', p_device_id, '/', p_source_key)
    AND NOT EXISTS (
      SELECT 1 FROM private.voice_device_uploads u WHERE u.path = p_storage_path
        AND u.device_id = p_device_id AND u.organization_id = v_device.organization_id
        AND u.capture_id = p_source_key AND u.sha256 = p_sha256 AND u.session_id = p_session_id
        AND u.session_seq = p_session_seq AND u.recorded_at = p_recorded_at
        AND u.clock_state = p_clock_state AND u.expires_at > statement_timestamp()
    ) THEN
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

CREATE OR REPLACE FUNCTION public.expire_voice_captures() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_count integer;
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
  RETURN v_count;
END $$;

NOTIFY pgrst, 'reload schema';
