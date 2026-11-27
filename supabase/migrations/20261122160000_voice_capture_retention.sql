-- @REQ: VOICE-RETENTION
-- @REQ: VOICE-DRAFT-ISOLATION
-- @REQ: SEC-AUDIT-APPEND-ONLY

CREATE TABLE public.voice_retention_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  retention_days integer NOT NULL CHECK (retention_days BETWEEN 7 AND 90),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_retention_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voice_retention_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.voice_retention_settings TO authenticated, service_role;
CREATE POLICY voice_retention_staff ON public.voice_retention_settings FOR SELECT TO authenticated USING (
  (SELECT auth.jwt())->>'aal' = 'aal2' AND (SELECT public.check_mfa_requirement())
  AND ((SELECT auth.jwt())->'app_metadata'->>'role' = 'super_admin'
    OR ((SELECT auth.jwt())->'app_metadata'->>'role' = 'org_admin'
      AND organization_id = (SELECT public.get_jwt_organization_id())))
);

CREATE FUNCTION public.set_voice_capture_retention(p_organization_id uuid, p_days integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_old integer;
BEGIN
  PERFORM private.require_report_staff(p_organization_id, ARRAY['org_admin','super_admin'], true);
  IF p_days IS NULL OR p_days NOT BETWEEN 7 AND 90 THEN
    RAISE EXCEPTION 'INVALID_VOICE_RETENTION' USING ERRCODE = '22023';
  END IF;
  PERFORM id FROM public.organizations WHERE id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_ORGANIZATION_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  SELECT retention_days INTO v_old FROM public.voice_retention_settings WHERE organization_id = p_organization_id;
  IF COALESCE(v_old, 30) = p_days THEN RETURN p_days; END IF;
  INSERT INTO public.voice_retention_settings (organization_id, retention_days) VALUES (p_organization_id, p_days)
    ON CONFLICT (organization_id) DO UPDATE SET retention_days = EXCLUDED.retention_days, updated_at = now();
  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
    VALUES (p_organization_id, 'VOICE_CAPTURE_RETENTION_CHANGED', auth.uid(),
      jsonb_build_object('previous_days', COALESCE(v_old, 30), 'retention_days', p_days));
  RETURN p_days;
END $$;

CREATE TABLE public.voice_storage_deletions (
  path text PRIMARY KEY,
  queued_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_storage_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voice_storage_deletions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON public.voice_storage_deletions TO service_role;
CREATE INDEX voice_storage_deletions_queue ON public.voice_storage_deletions (queued_at, path);

CREATE FUNCTION private.queue_deleted_voice_storage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'voice_captures' THEN
    INSERT INTO public.voice_storage_deletions (path) VALUES (OLD.storage_path) ON CONFLICT DO NOTHING;
    INSERT INTO public.voice_storage_deletions (path)
      SELECT name FROM storage.objects WHERE bucket_id = 'voice-recordings'
        AND name LIKE concat(OLD.organization_id, '/transcripts/', OLD.id, '/%')
      ON CONFLICT DO NOTHING;
  ELSIF OLD.transcript_path IS NOT NULL THEN
    INSERT INTO public.voice_storage_deletions (path) VALUES (OLD.transcript_path) ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END $$;

CREATE FUNCTION private.queue_erased_resident_voice_audio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Mieszany plik może zawierać dane usuwanej osoby również poza jej wycinkiem.
  INSERT INTO public.voice_storage_deletions (path) SELECT DISTINCT c.storage_path
    FROM public.voice_captures c JOIN public.voice_segments s ON s.capture_id = c.id
    WHERE s.resident_id = OLD.id AND c.organization_id = OLD.organization_id
    ON CONFLICT DO NOTHING;
  RETURN OLD;
END $$;

CREATE FUNCTION private.prevent_voice_storage_reuse() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.voice_storage_deletions WHERE path = NEW.storage_path) THEN
    RAISE EXCEPTION 'VOICE_STORAGE_PATH_EXPIRING' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER queue_capture_storage_delete BEFORE DELETE ON public.voice_captures
  FOR EACH ROW EXECUTE FUNCTION private.queue_deleted_voice_storage();
CREATE TRIGGER queue_segment_storage_delete BEFORE DELETE ON public.voice_segments
  FOR EACH ROW EXECUTE FUNCTION private.queue_deleted_voice_storage();
CREATE TRIGGER queue_resident_voice_erasure BEFORE DELETE ON public.residents
  FOR EACH ROW EXECUTE FUNCTION private.queue_erased_resident_voice_audio();
CREATE TRIGGER prevent_pending_voice_storage_reuse BEFORE INSERT ON public.voice_captures
  FOR EACH ROW EXECUTE FUNCTION private.prevent_voice_storage_reuse();

CREATE FUNCTION public.expire_voice_captures() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_count integer;
BEGIN
  PERFORM private.require_report_service();
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

REVOKE ALL ON FUNCTION private.queue_deleted_voice_storage(), private.queue_erased_resident_voice_audio(),
  private.prevent_voice_storage_reuse(), public.set_voice_capture_retention(uuid,integer), public.expire_voice_captures()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_voice_capture_retention(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_voice_captures() TO service_role;
NOTIFY pgrst, 'reload schema';
