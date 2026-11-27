-- @REQ: VOICE-RETENTION
-- Keep both the pilot draft cleanup and the device-upload reservation cleanup.
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
      AND split_part(o.name, '/', 2) = 'app_general'
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
