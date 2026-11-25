-- @REQ: SEC-AUDIT-APPEND-ONLY
-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: VOICE-DEVICE-INGEST

CREATE FUNCTION private.audit_voice_capture_receipt()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
    VALUES (NEW.organization_id, NEW.selected_resident_id, 'VOICE_CAPTURE_RECEIVED', NEW.author_id,
      jsonb_strip_nulls(jsonb_build_object(
        'capture_id', NEW.id, 'source', NEW.source, 'author_id', NEW.author_id,
        'device_id', NEW.device_id, 'session_id', NEW.session_id, 'session_seq', NEW.session_seq,
        'recorded_at', NEW.recorded_at, 'received_at', NEW.received_at, 'clock_state', NEW.clock_state
      )));
  RETURN NEW;
END $$;
CREATE TRIGGER voice_capture_receipt_audit AFTER INSERT ON public.voice_captures
  FOR EACH ROW EXECUTE FUNCTION private.audit_voice_capture_receipt();
REVOKE ALL ON FUNCTION private.audit_voice_capture_receipt() FROM PUBLIC, anon, authenticated, service_role;
