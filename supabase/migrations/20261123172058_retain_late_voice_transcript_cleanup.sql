-- @REQ: VOICE-RETENTION
-- @REQ: VOICE-RESIDENT-ASSIGN
CREATE FUNCTION private.voice_transcript_capture_id(p_path text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_path ~ (
    '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/transcripts/' ||
    '[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[^/]+/[^/]+$'
  ) THEN split_part(p_path, '/', 3)::uuid END
$$;

CREATE FUNCTION private.queue_late_voice_transcript()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_capture_id uuid := private.voice_transcript_capture_id(NEW.name);
BEGIN
  IF v_capture_id IS NULL THEN RETURN NEW; END IF;

  -- Serialize with removal of the source. If storage wins, source deletion will see
  -- the object. If source deletion wins, this upload itself records the cleanup.
  PERFORM 1 FROM public.voice_captures c
    WHERE c.id = v_capture_id AND c.organization_id::text = split_part(NEW.name, '/', 1)
    FOR SHARE OF c;
  IF NOT FOUND THEN
    INSERT INTO public.voice_storage_deletions (path) VALUES (NEW.name)
    ON CONFLICT (path) DO UPDATE SET
      queued_at = excluded.queued_at, lease_token = NULL, leased_until = NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER queue_late_voice_transcript AFTER INSERT ON storage.objects
FOR EACH ROW WHEN (NEW.bucket_id = 'voice-recordings' AND split_part(NEW.name, '/', 2) = 'transcripts')
EXECUTE FUNCTION private.queue_late_voice_transcript();

CREATE FUNCTION public.queue_abandoned_voice_transcripts(p_capture_id uuid, p_paths text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_org uuid; v_count integer;
BEGIN
  PERFORM private.require_report_service();
  -- Called after the worker finishes or releases its lease. Waiting on the source
  -- makes a successful finalization visible even when the worker lost its response.
  SELECT c.organization_id INTO v_org FROM public.voice_captures c
    WHERE c.id = p_capture_id FOR UPDATE;
  INSERT INTO public.voice_storage_deletions (path)
    SELECT DISTINCT p.path FROM unnest(p_paths) AS p(path)
    WHERE private.voice_transcript_capture_id(p.path) = p_capture_id
      AND (v_org IS NULL OR split_part(p.path, '/', 1) = v_org::text)
      AND NOT EXISTS (SELECT 1 FROM public.voice_segments s
        WHERE s.capture_id = p_capture_id AND s.transcript_path = p.path)
    ORDER BY p.path
  ON CONFLICT (path) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION private.voice_transcript_capture_id(text), private.queue_late_voice_transcript(),
  public.queue_abandoned_voice_transcripts(uuid,text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.queue_abandoned_voice_transcripts(uuid,text[]) TO service_role;

-- Pick up objects already written by a worker after its source was removed.
INSERT INTO public.voice_storage_deletions (path)
SELECT o.name FROM storage.objects o
CROSS JOIN LATERAL (SELECT private.voice_transcript_capture_id(o.name) AS capture_id) src
WHERE o.bucket_id = 'voice-recordings' AND src.capture_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.voice_captures c
    WHERE c.id = src.capture_id AND c.organization_id::text = split_part(o.name, '/', 1))
ON CONFLICT (path) DO NOTHING;

NOTIFY pgrst, 'reload schema';
