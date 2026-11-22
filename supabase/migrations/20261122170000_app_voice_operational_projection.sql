-- @REQ: VOICE-DOCK-REPORTS
-- @REQ: VOICE-ZERO-GUESSING
-- @REQ: VOICE-DRAFT-ISOLATION

CREATE TABLE public.voice_app_report_jobs (
  draft_id uuid PRIMARY KEY REFERENCES public.voice_draft_notes(id) ON DELETE CASCADE,
  token uuid,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  completed_at timestamptz
);
CREATE INDEX voice_app_report_jobs_waiting ON public.voice_app_report_jobs(available_at, draft_id)
  WHERE completed_at IS NULL AND attempts < 5;
ALTER TABLE public.voice_app_report_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voice_app_report_jobs FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.queue_processed_app_voice_draft()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'PROCESSED' AND NULLIF(btrim(NEW.transcript), '') IS NOT NULL THEN
    INSERT INTO public.voice_app_report_jobs (draft_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER processed_app_voice_report AFTER INSERT OR UPDATE OF status ON public.voice_draft_notes
  FOR EACH ROW EXECUTE FUNCTION private.queue_processed_app_voice_draft();
REVOKE ALL ON FUNCTION private.queue_processed_app_voice_draft() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.claim_processed_app_voice_draft(p_draft_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_draft public.voice_draft_notes; v_job public.voice_app_report_jobs; v_org uuid;
BEGIN
  PERFORM private.require_report_service();
  SELECT j.* INTO v_job FROM public.voice_app_report_jobs j
    JOIN public.voice_draft_notes d ON d.id = j.draft_id AND d.status = 'PROCESSED'
    JOIN public.residents r ON r.id = d.resident_id AND r.archived_at IS NULL
    WHERE (p_draft_id IS NULL OR j.draft_id = p_draft_id) AND j.completed_at IS NULL AND j.attempts < 5
      AND j.available_at <= now() AND public.has_org_feature(r.organization_id, 'module_voice_and_reports')
    ORDER BY j.available_at, j.draft_id LIMIT 1 FOR UPDATE OF j SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.voice_app_report_jobs SET token = gen_random_uuid(), attempts = attempts + 1,
    available_at = now() + interval '10 minutes' WHERE draft_id = v_job.draft_id RETURNING * INTO v_job;
  SELECT d.* INTO STRICT v_draft FROM public.voice_draft_notes d WHERE d.id = v_job.draft_id;
  SELECT organization_id INTO STRICT v_org FROM public.residents WHERE id = v_draft.resident_id;
  RETURN jsonb_build_object('token', v_job.token, 'draft_id', v_draft.id, 'organization_id', v_org,
    'resident_id', v_draft.resident_id, 'author_id', v_draft.nurse_id, 'transcript', v_draft.transcript,
    'residents', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'firstName', r.first_name,
      'lastName', r.last_name, 'room', loc.room, 'bed', loc.bed)), '[]'::jsonb)
      FROM public.residents r LEFT JOIN LATERAL (
        SELECT rm.number::text AS room, b.label AS bed FROM public.bed_assignments a
          JOIN public.beds b ON b.id = a.bed_id JOIN public.rooms rm ON rm.id = b.room_id
        WHERE a.resident_id = r.id AND rm.organization_id = v_org
          AND a.assigned_at <= v_draft.created_at AND (a.unassigned_at IS NULL OR a.unassigned_at > v_draft.created_at)
        ORDER BY a.assigned_at DESC, a.id LIMIT 1
      ) loc ON true WHERE r.organization_id = v_org),
    'staff_names', (SELECT COALESCE(jsonb_agg(raw_user_meta_data->>'full_name'), '[]'::jsonb) FROM auth.users
      WHERE raw_app_meta_data->>'organization_id' = v_org::text AND raw_user_meta_data->>'full_name' IS NOT NULL));
END $$;

CREATE FUNCTION public.complete_processed_app_voice_draft(p_draft_id uuid, p_token uuid, p_result jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_draft public.voice_draft_notes; v_org uuid; v_operations text[]; v_codes text[];
BEGIN
  PERFORM private.require_report_service();
  SELECT * INTO v_draft FROM public.voice_draft_notes WHERE id = p_draft_id AND status = 'PROCESSED';
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT organization_id INTO v_org FROM public.residents WHERE id = v_draft.resident_id AND archived_at IS NULL FOR KEY SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM id FROM public.voice_draft_notes WHERE id = p_draft_id AND status = 'PROCESSED' FOR KEY SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM draft_id FROM public.voice_app_report_jobs
    WHERE draft_id = p_draft_id AND token = p_token AND completed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_result IS NULL THEN
    UPDATE public.voice_app_report_jobs SET token = NULL, available_at = now() + interval '3 minutes' WHERE draft_id = p_draft_id;
    RETURN true;
  END IF;
  IF jsonb_typeof(p_result) <> 'object' OR length(p_result::text) > 16000 THEN
    RAISE EXCEPTION 'INVALID_APP_VOICE_PROJECTION' USING ERRCODE = '22023';
  END IF;
  v_operations := private.parse_text_array_json_strict((p_result->'operational_facts')::text);
  v_codes := private.parse_text_array_json_strict((p_result->'category_codes')::text);
  IF cardinality(v_operations) > 0 THEN
    PERFORM public.record_voice_sanitized_event(v_org::text, p_draft_id::text, 'APP', 'resident',
      v_draft.resident_id::text, v_draft.nurse_id::text, array_to_string(v_operations, E'\n'), to_jsonb(v_codes)::text,
      to_jsonb(v_draft.created_at)#>>'{}', '{"pipeline_stage":"CLASSIFY"}');
  END IF;
  UPDATE public.voice_app_report_jobs SET token = NULL, completed_at = now() WHERE draft_id = p_draft_id;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.claim_processed_app_voice_draft(uuid), public.complete_processed_app_voice_draft(uuid,uuid,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_processed_app_voice_draft(uuid), public.complete_processed_app_voice_draft(uuid,uuid,jsonb)
  TO service_role;
NOTIFY pgrst, 'reload schema';
