-- @REQ: VOICE-DOCK-REPORTS
-- @REQ: ORG-ISOLATION

CREATE POLICY operational_report_recipients ON public.operational_reports AS RESTRICTIVE FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_report_configs c
  WHERE c.organization_id = operational_reports.organization_id AND c.category_code = operational_reports.category_code
    AND ((SELECT auth.jwt())->'app_metadata'->>'role') = ANY(c.recipient_roles)));

CREATE TABLE public.operational_report_jobs (
  organization_id uuid NOT NULL,
  category_code text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  lease_token uuid,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  PRIMARY KEY (organization_id, category_code, period_start, period_end),
  FOREIGN KEY (organization_id, category_code)
    REFERENCES public.organization_report_configs(organization_id, category_code) ON DELETE CASCADE
);
ALTER TABLE public.operational_report_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operational_report_jobs FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.claim_due_operational_report(p_organization_id uuid DEFAULT NULL, p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_job public.operational_report_jobs; v_mode text; v_local timestamp := p_now AT TIME ZONE 'Europe/Warsaw';
BEGIN
  PERFORM private.require_report_service();
  WITH windows AS (
    SELECT c.organization_id, c.category_code, c.schedule_mode, b.local_start AT TIME ZONE 'Europe/Warsaw' AS period_start,
      b.local_end AT TIME ZONE 'Europe/Warsaw' AS period_end
    FROM public.organization_report_configs c
    CROSS JOIN LATERAL (
      SELECT date_trunc('day', v_local) - interval '1 day' AS local_start, date_trunc('day', v_local) AS local_end
        WHERE c.schedule_mode = 'daily'
      UNION ALL SELECT date_trunc('week', v_local) - interval '1 week', date_trunc('week', v_local)
        WHERE c.schedule_mode = 'weekly'
      UNION ALL SELECT d.day + s.start_time, d.day + s.end_time + CASE WHEN s.crosses_midnight THEN interval '1 day' ELSE interval '0' END
        FROM public.shift_definitions s CROSS JOIN (VALUES ((v_local::date - 1)), (v_local::date)) d(day)
        WHERE s.organization_id = c.organization_id AND s.is_active AND c.schedule_mode = 'per_shift'
    ) b
    WHERE c.is_enabled AND c.archived_at IS NULL AND (p_organization_id IS NULL OR c.organization_id = p_organization_id)
      AND b.local_end <= v_local AND b.local_start < b.local_end
      AND c.created_at < b.local_end AT TIME ZONE 'Europe/Warsaw'
      AND public.has_org_feature(c.organization_id, 'module_voice_and_reports')
  ), candidate AS (
    SELECT w.* FROM windows w
    LEFT JOIN public.operational_report_jobs j USING (organization_id, category_code, period_start, period_end)
    LEFT JOIN public.operational_reports r USING (organization_id, category_code, period_start, period_end)
    WHERE (j.available_at IS NULL OR j.available_at <= p_now)
      AND (j.attempts IS NULL OR j.attempts < 5 OR j.completed_at IS NOT NULL)
      AND (r.id IS NULL OR (r.status = 'DRAFT' AND (r.requires_regeneration OR r.source_event_ids IS DISTINCT FROM
        ARRAY(SELECT e.id FROM public.voice_sanitized_events e
          WHERE e.organization_id = w.organization_id AND e.recorded_at >= w.period_start AND e.recorded_at < w.period_end
            AND e.metadata->>'pipeline_stage' = 'CLASSIFY' AND w.category_code = ANY(e.matched_categories)
          ORDER BY e.id))))
    ORDER BY w.period_end, w.organization_id, w.category_code LIMIT 1
  )
  INSERT INTO public.operational_report_jobs
    (organization_id, category_code, period_start, period_end, lease_token, available_at, attempts)
  SELECT organization_id, category_code, period_start, period_end, gen_random_uuid(), p_now + interval '10 minutes', 1
    FROM candidate
  ON CONFLICT (organization_id, category_code, period_start, period_end) DO UPDATE SET
    lease_token = EXCLUDED.lease_token, available_at = EXCLUDED.available_at,
    attempts = CASE WHEN operational_report_jobs.completed_at IS NULL THEN operational_report_jobs.attempts + 1 ELSE 1 END,
    completed_at = NULL
  WHERE operational_report_jobs.available_at <= p_now
  RETURNING * INTO v_job;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT schedule_mode INTO v_mode FROM public.organization_report_configs
    WHERE organization_id = v_job.organization_id AND category_code = v_job.category_code;
  RETURN to_jsonb(v_job) || jsonb_build_object('schedule_mode', v_mode);
END $$;

CREATE FUNCTION public.complete_operational_report_job(p_token uuid, p_success boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  PERFORM private.require_report_service();
  UPDATE public.operational_report_jobs SET lease_token = NULL,
    available_at = now() + CASE WHEN p_success THEN interval '2 minutes' ELSE interval '5 minutes' END,
    completed_at = CASE WHEN p_success THEN now() END WHERE lease_token = p_token;
  RETURN FOUND;
END $$;

CREATE UNIQUE INDEX operational_report_jobs_token ON public.operational_report_jobs(lease_token)
  WHERE lease_token IS NOT NULL;

REVOKE ALL ON FUNCTION public.claim_due_operational_report(uuid,timestamptz), public.complete_operational_report_job(uuid,boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_operational_report(uuid,timestamptz), public.complete_operational_report_job(uuid,boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.record_generated_operational_report(
  p_org_id text, p_category_code text, p_period_start text, p_period_end text, p_source_event_ids_json text,
  p_content_json text, p_ai_model text, p_ai_prompt_version text, p_ai_generated_at text
) RETURNS public.operational_reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_org uuid; v_start timestamptz; v_end timestamptz; v_generated timestamptz; v_source_ids uuid[];
  v_content jsonb; v_config public.organization_report_configs; v_row public.operational_reports;
  v_no_data boolean; v_matching integer;
BEGIN
  PERFORM private.require_report_service();
  v_org := private.parse_uuid_strict(p_org_id);
  v_start := private.parse_timestamptz_strict(p_period_start);
  v_end := private.parse_timestamptz_strict(p_period_end);
  v_generated := private.parse_timestamptz_strict(p_ai_generated_at);
  v_source_ids := private.parse_uuid_array_json_strict(p_source_event_ids_json);
  v_content := private.parse_jsonb_strict(p_content_json);
  PERFORM private.report_required(p_category_code);
  PERFORM private.report_required(p_ai_model);
  PERFORM private.report_required(p_ai_prompt_version);
  IF NOT public.has_org_feature(v_org, 'module_voice_and_reports') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  IF v_end <= v_start OR p_ai_prompt_version !~ '^[A-Za-z0-9._-]{1,80}$' THEN
    RAISE EXCEPTION 'INVALID_REPORT_PARAMETERS' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_config FROM public.organization_report_configs
    WHERE organization_id = v_org AND category_code = p_category_code AND is_enabled AND archived_at IS NULL
    FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_CATEGORY_NOT_FOUND' USING ERRCODE = '42501'; END IF;

  v_source_ids := ARRAY(SELECT DISTINCT id FROM unnest(v_source_ids) id ORDER BY id);
  PERFORM r.id FROM public.residents r WHERE r.id IN (
    SELECT e.resident_id FROM public.voice_sanitized_events e
      WHERE e.organization_id = v_org AND e.id = ANY(v_source_ids)
  ) ORDER BY r.id FOR KEY SHARE;
  PERFORM e.id FROM public.voice_sanitized_events e
    WHERE e.organization_id = v_org AND e.id = ANY(v_source_ids) ORDER BY e.id FOR KEY SHARE;
  SELECT count(*) INTO v_matching FROM public.voice_sanitized_events e
    WHERE e.organization_id = v_org AND e.id = ANY(v_source_ids) AND e.recorded_at >= v_start AND e.recorded_at < v_end
      AND e.metadata->>'pipeline_stage' = 'CLASSIFY' AND p_category_code = ANY(e.matched_categories);
  IF v_matching <> cardinality(v_source_ids) THEN
    RAISE EXCEPTION 'INVALID_SOURCE_EVENTS_FOR_PERIOD' USING ERRCODE = '23514';
  END IF;
  PERFORM private.validate_operational_report_content(v_org, v_content, v_config.allowed_sections, v_source_ids);
  v_no_data := (v_content->>'no_data')::boolean;
  IF v_no_data IS DISTINCT FROM (cardinality(v_source_ids) = 0) THEN
    RAISE EXCEPTION 'INVALID_SOURCE_EVENTS_FOR_PERIOD' USING ERRCODE = '23514';
  END IF;
  IF v_no_data THEN
    IF p_ai_model <> 'rule-based-no-data-v1'
      OR v_content IS DISTINCT FROM private.operational_report_placeholder(true, v_config.allowed_sections) THEN
      RAISE EXCEPTION 'INVALID_NO_DATA_REPORT' USING ERRCODE = '23514';
    END IF;
  ELSIF p_ai_model NOT IN ('mistral-large-eu', 'mistral-small-eu', 'gemini-2.5-flash-eu', 'gemini-2.5-pro-eu',
    'gpt-4o-mini-eu', 'gpt-4o-eu', 'claude-3-5-sonnet-eu', 'bielik-11b-v2.3-instruct-eu') THEN
    RAISE EXCEPTION 'INVALID_REPORT_AI_MODEL' USING ERRCODE = '23514';
  END IF;

  PERFORM private.lock_operational_report_writes(v_org);
  IF v_no_data AND EXISTS (SELECT 1 FROM public.voice_sanitized_events e
    WHERE e.organization_id = v_org AND e.recorded_at >= v_start AND e.recorded_at < v_end
      AND e.metadata->>'pipeline_stage' = 'CLASSIFY' AND p_category_code = ANY(e.matched_categories)) THEN
    RAISE EXCEPTION 'QUALIFYING_EVENTS_EXIST_FOR_PERIOD' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_row FROM public.operational_reports
    WHERE organization_id = v_org AND category_code = p_category_code AND period_start = v_start AND period_end = v_end
    ORDER BY id FOR UPDATE;
  IF v_row.id IS NOT NULL AND NOT v_row.requires_regeneration
    AND ROW(v_row.source_event_ids, v_row.content, v_row.ai_model, v_row.ai_prompt_version)
      IS NOT DISTINCT FROM ROW(v_source_ids, v_content, p_ai_model, p_ai_prompt_version) THEN
    RETURN v_row;
  END IF;
  IF v_row.status = 'APPROVED' THEN RAISE EXCEPTION 'REPORT_ALREADY_APPROVED' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.operational_reports
    (organization_id, category_code, period_start, period_end, source_event_ids, content,
      ai_model, ai_prompt_version, ai_generated_at)
  VALUES (v_org, p_category_code, v_start, v_end, v_source_ids, v_content,
    p_ai_model, p_ai_prompt_version, v_generated)
  ON CONFLICT (organization_id, category_code, period_start, period_end) DO UPDATE SET
    source_event_ids = EXCLUDED.source_event_ids, content = EXCLUDED.content, requires_regeneration = false,
    ai_model = EXCLUDED.ai_model, ai_prompt_version = EXCLUDED.ai_prompt_version,
    ai_generated_at = EXCLUDED.ai_generated_at, updated_at = pg_catalog.now()
  RETURNING * INTO v_row;
  INSERT INTO public.audit_logs (organization_id, action, payload)
    VALUES (v_org, 'OPERATIONAL_REPORT_GENERATED', jsonb_build_object('report_id', v_row.id));
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.approve_operational_report(p_report_id text) RETURNS public.operational_reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_id uuid := private.parse_uuid_strict(p_report_id); v_org uuid; v_row public.operational_reports;
BEGIN
  SELECT organization_id INTO v_org FROM public.operational_reports WHERE id = v_id;
  PERFORM private.require_report_staff(v_org, ARRAY['org_admin', 'nurse'], true);
  PERFORM private.lock_operational_report_writes(v_org);
  SELECT * INTO v_row FROM public.operational_reports WHERE id = v_id ORDER BY id FOR UPDATE;
  IF v_row.id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organization_report_configs c
      WHERE c.organization_id = v_org AND c.category_code = v_row.category_code
      AND (auth.jwt()->'app_metadata'->>'role') = ANY(c.recipient_roles)
  ) THEN RAISE EXCEPTION 'REPORT_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF v_row.requires_regeneration THEN RAISE EXCEPTION 'REPORT_REQUIRES_REGENERATION' USING ERRCODE = '23514'; END IF;
  IF v_row.status = 'APPROVED' THEN RAISE EXCEPTION 'REPORT_ALREADY_APPROVED' USING ERRCODE = '23514'; END IF;
  UPDATE public.operational_reports SET
    status = 'APPROVED', approved_by = auth.uid(), approved_at = pg_catalog.now(), updated_at = pg_catalog.now()
  WHERE id = v_id RETURNING * INTO v_row;
  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
    VALUES (v_org, 'OPERATIONAL_REPORT_APPROVED', auth.uid(), jsonb_build_object('report_id', v_row.id));
  RETURN v_row;
END $$;

NOTIFY pgrst, 'reload schema';
