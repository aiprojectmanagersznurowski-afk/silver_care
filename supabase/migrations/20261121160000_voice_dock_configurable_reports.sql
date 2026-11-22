-- @REQ: VOICE-DOCK-REPORTS
-- @REQ: VOICE-MEDICAL-STRIP
-- @REQ: SEC-NO-PII-LOGS
-- @REQ: SEC-MFA-STAFF
-- @REQ: ORG-ISOLATION

CREATE TABLE public.organization_report_configs (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  category_code text NOT NULL,
  category_label text NOT NULL,
  classifier_hint text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT true,
  schedule_mode text NOT NULL,
  allowed_sections text[] NOT NULL,
  recipient_roles text[] NOT NULL,
  requires_approval boolean NOT NULL DEFAULT true,
  retention_days integer NOT NULL DEFAULT 365,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (organization_id, category_code)
);

CREATE TABLE public.voice_sanitized_events (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  draft_note_id uuid REFERENCES public.voice_draft_notes (id) ON DELETE SET NULL,
  segment_id uuid,
  capture_source text NOT NULL,
  scope text NOT NULL,
  resident_id uuid REFERENCES public.residents (id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  sanitized_text text NOT NULL,
  matched_categories text[] NOT NULL,
  recorded_at timestamptz NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  FOREIGN KEY (segment_id, organization_id) REFERENCES public.voice_segments (id, organization_id)
    ON DELETE SET NULL (segment_id)
);
CREATE UNIQUE INDEX uq_voice_sanitized_events_draft_note
  ON public.voice_sanitized_events (draft_note_id) WHERE draft_note_id IS NOT NULL;
CREATE UNIQUE INDEX uq_voice_sanitized_events_segment
  ON public.voice_sanitized_events (segment_id) WHERE segment_id IS NOT NULL;
CREATE INDEX voice_sanitized_events_org_period ON public.voice_sanitized_events (organization_id, recorded_at);
CREATE INDEX voice_sanitized_events_resident ON public.voice_sanitized_events (resident_id)
  WHERE resident_id IS NOT NULL;

CREATE TABLE public.operational_reports (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  category_code text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  source_event_ids uuid[] NOT NULL,
  content jsonb NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  requires_regeneration boolean NOT NULL DEFAULT false,
  ai_model text NOT NULL,
  ai_prompt_version text NOT NULL,
  ai_generated_at timestamptz NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  FOREIGN KEY (organization_id, category_code)
    REFERENCES public.organization_report_configs (organization_id, category_code),
  UNIQUE (organization_id, category_code, period_start, period_end)
);
CREATE INDEX operational_reports_sources ON public.operational_reports USING gin (source_event_ids);

DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['organization_report_configs', 'voice_sanitized_events', 'operational_reports'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated, service_role', v_table);
    EXECUTE format($policy$
      CREATE POLICY voice_reports_module ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated
      USING (public.has_org_feature(organization_id, 'module_voice_and_reports'))$policy$, v_table);
    EXECUTE format($policy$
      CREATE POLICY voice_reports_mfa ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated
      USING (CASE WHEN ((SELECT auth.jwt())->>'aal') = 'aal2'
        THEN COALESCE((SELECT public.check_mfa_requirement()), false) ELSE false END)$policy$, v_table);
    EXECUTE format($policy$
      CREATE POLICY voice_reports_staff ON public.%I FOR SELECT TO authenticated
      USING (
        (organization_id = (SELECT public.get_jwt_organization_id())
          AND ((SELECT auth.jwt())->'app_metadata'->>'role') IN ('org_admin', 'nurse'))
        OR (%L = 'organization_report_configs' AND ((SELECT auth.jwt())->'app_metadata'->>'role') = 'super_admin')
      )$policy$, v_table, v_table);
  END LOOP;
END $$;

ALTER ROLE anon SET log_parameter_max_length_on_error = 0;
ALTER ROLE authenticated SET log_parameter_max_length_on_error = 0;
ALTER ROLE service_role SET log_parameter_max_length_on_error = 0;
ALTER ROLE authenticator SET log_parameter_max_length_on_error = 0;
ALTER ROLE postgres SET log_parameter_max_length_on_error = 0;

CREATE FUNCTION private.report_required(p_value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  IF p_value IS NULL OR pg_catalog.btrim(p_value) = '' THEN
    RAISE EXCEPTION 'MISSING_REQUIRED_PARAMETER' USING ERRCODE = '22023';
  END IF;
  RETURN p_value;
END $$;

CREATE FUNCTION private.parse_uuid_strict(p_value text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  PERFORM private.report_required(p_value);
  IF p_value !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'INVALID_UUID_PARAMETER' USING ERRCODE = '22023';
  END IF;
  RETURN p_value::uuid;
END $$;

CREATE FUNCTION private.parse_optional_uuid_strict(p_value text) RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
  SELECT private.parse_uuid_strict(p_value)
$$;

CREATE FUNCTION private.parse_int_strict(p_value text) RETURNS integer
LANGUAGE plpgsql IMMUTABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  PERFORM private.report_required(p_value);
  BEGIN
    IF p_value !~ '^-?[0-9]+$' THEN RAISE EXCEPTION 'INVALID'; END IF;
    RETURN p_value::integer;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'INVALID_INTEGER_PARAMETER' USING ERRCODE = '22023';
  END;
END $$;

CREATE FUNCTION private.parse_bool_strict(p_value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  PERFORM private.report_required(p_value);
  IF p_value NOT IN ('true', 'false') THEN
    RAISE EXCEPTION 'INVALID_BOOLEAN_PARAMETER' USING ERRCODE = '22023';
  END IF;
  RETURN p_value::boolean;
END $$;

CREATE FUNCTION private.parse_timestamptz_strict(p_value text) RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  PERFORM private.report_required(p_value);
  BEGIN
    IF p_value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' THEN RAISE EXCEPTION 'INVALID'; END IF;
    RETURN p_value::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'INVALID_TIMESTAMP_PARAMETER' USING ERRCODE = '22023';
  END;
END $$;

CREATE FUNCTION private.parse_optional_timestamptz_strict(p_value text) RETURNS timestamptz
LANGUAGE sql STABLE STRICT SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
  SELECT private.parse_timestamptz_strict(p_value)
$$;

CREATE FUNCTION private.parse_jsonb_strict(p_value text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  PERFORM private.report_required(p_value);
  BEGIN
    RETURN p_value::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'INVALID_JSON_PAYLOAD' USING ERRCODE = '22023';
  END;
END $$;

CREATE FUNCTION private.parse_text_array_json_strict(p_value text) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_json jsonb := private.parse_jsonb_strict(p_value);
BEGIN
  IF pg_catalog.jsonb_typeof(v_json) <> 'array' OR EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(v_json) e WHERE pg_catalog.jsonb_typeof(e) <> 'string'
  ) THEN RAISE EXCEPTION 'INVALID_ARRAY_PAYLOAD' USING ERRCODE = '22023'; END IF;
  RETURN ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_json));
END $$;

CREATE FUNCTION private.parse_uuid_array_json_strict(p_value text) RETURNS uuid[]
LANGUAGE plpgsql IMMUTABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_items text[] := private.parse_text_array_json_strict(p_value);
BEGIN
  BEGIN
    RETURN ARRAY(SELECT private.parse_uuid_strict(e) FROM unnest(v_items) e);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'INVALID_ARRAY_PAYLOAD' USING ERRCODE = '22023';
  END;
END $$;

CREATE FUNCTION private.require_report_service() RETURNS void
LANGUAGE plpgsql STABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE FUNCTION private.require_report_staff(p_org uuid, p_roles text[], p_write boolean) RETURNS void
LANGUAGE plpgsql SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_user uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_role text := v_claims->'app_metadata'->>'role';
BEGIN
  IF v_user IS NULL OR NOT COALESCE(v_role = ANY(p_roles), false)
    OR (v_role <> 'super_admin' AND p_org IS DISTINCT FROM public.get_jwt_organization_id()) THEN
    RAISE EXCEPTION 'REPORT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_claims->>'aal' IS DISTINCT FROM 'aal2' OR NOT COALESCE(public.check_mfa_requirement(), false) THEN
    RAISE EXCEPTION 'MFA_AAL2_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_org_feature(p_org, 'module_voice_and_reports') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  IF p_write THEN
    PERFORM private.impersonation_actor_lock(v_user);
    IF NULLIF(v_claims->>'impersonator_id', '') IS NOT NULL
      OR NULLIF(v_claims->'app_metadata'->>'impersonator_id', '') IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.active_impersonation_sessions s
        WHERE (s.actor_id = v_user OR s.target_admin_id = v_user) AND s.expires_at > pg_catalog.now()) THEN
      RAISE EXCEPTION 'IMPERSONATION_WRITE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
  END IF;
END $$;

CREATE FUNCTION private.assert_no_org_registry_identifiers(p_org uuid, p_value text) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_words text := ' ' || regexp_replace(lower(p_value), '[^[:alnum:]]+', ' ', 'g') || ' ';
BEGIN
  IF p_value ~* '[[:alnum:]_.%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
    OR p_value ~ '\m[0-9]{11}\M'
    OR p_value ~ '\m([0-9][ -]?){8}[0-9]\M'
    OR p_value ~* '\m(pacjent[[:alpha:]]*|podejrzeni[[:alpha:]]*|diagnoz[[:alpha:]]*|CRP|EKG|SpO2|HRV|HbA1c|saturacj[[:alpha:]]*|cisnieni[[:alpha:]]*|ciśnieni[[:alpha:]]*|insulin[[:alpha:]]*|paracetamol[[:alpha:]]*|antybiotyk[[:alpha:]]*|furosemid[[:alpha:]]*|dawk[[:alpha:]]*|zaleceni[[:alpha:]]* lekarsk[[:alpha:]]*|lek[[:alpha:]]* przepis[[:alpha:]]*)\M' THEN
    RAISE EXCEPTION 'UNSAFE_REPORT_TEXT' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.residents r
    CROSS JOIN LATERAL (VALUES (r.first_name), (r.last_name)) AS name(value)
    WHERE r.organization_id = p_org AND length(btrim(name.value)) >= 2
      AND strpos(v_words, ' ' || regexp_replace(lower(name.value), '[^[:alnum:]]+', ' ', 'g') || ' ') > 0
  ) THEN RAISE EXCEPTION 'REPORT_REGISTRY_IDENTIFIER' USING ERRCODE = '22023'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.rooms r LEFT JOIN public.beds b ON b.room_id = r.id
    WHERE r.organization_id = p_org
      AND (strpos(v_words, ' pokój ' || lower(r.number) || ' ') > 0
        OR strpos(v_words, ' pokoju ' || lower(r.number) || ' ') > 0
        OR strpos(v_words, ' w ' || lower(r.number) || ' ') > 0
        OR strpos(v_words, ' łóżko ' || lower(b.label) || ' ') > 0)
  ) THEN RAISE EXCEPTION 'REPORT_REGISTRY_IDENTIFIER' USING ERRCODE = '22023'; END IF;
END $$;

CREATE FUNCTION private.seed_report_categories(p_org uuid) RETURNS void
LANGUAGE sql SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
  INSERT INTO public.organization_report_configs
    (organization_id, category_code, category_label, schedule_mode, allowed_sections, recipient_roles)
  VALUES
    (p_org, 'audit_operational', 'Raport audytowy', 'daily', ARRAY['summary', 'events', 'action_items'], ARRAY['org_admin']),
    (p_org, 'technical_maintenance', 'Raport dla działu technicznego', 'daily',
      ARRAY['summary', 'events', 'locations', 'action_items'], ARRAY['org_admin', 'nurse']),
    (p_org, 'catering_kitchen', 'Raport o kuchni i cateringu', 'daily',
      ARRAY['summary', 'events', 'action_items'], ARRAY['org_admin', 'nurse'])
  ON CONFLICT (organization_id, category_code) DO NOTHING
$$;

CREATE FUNCTION private.seed_report_categories_after_organization() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  PERFORM private.seed_report_categories(NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER seed_report_categories_after_organization AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION private.seed_report_categories_after_organization();
SELECT private.seed_report_categories(id) FROM public.organizations;

CREATE FUNCTION private.validate_report_configuration(
  p_code text, p_schedule text, p_sections text[], p_roles text[], p_days integer
) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  IF private.report_required(p_code) !~ '^[a-z][a-z0-9_]{0,62}$'
    OR private.report_required(p_schedule) NOT IN ('manual', 'per_shift', 'daily', 'weekly')
    OR NOT p_sections <@ ARRAY['summary', 'events', 'locations', 'action_items', 'source_quotes']
    OR NOT p_roles <@ ARRAY['org_admin', 'nurse'] OR cardinality(p_roles) = 0
    OR cardinality(p_sections) <> (SELECT count(DISTINCT value) FROM unnest(p_sections) value)
    OR cardinality(p_roles) <> (SELECT count(DISTINCT value) FROM unnest(p_roles) value) THEN
    RAISE EXCEPTION 'INVALID_REPORT_CONFIGURATION' USING ERRCODE = '22023';
  END IF;
  IF p_days NOT BETWEEN 30 AND 1825 THEN
    RAISE EXCEPTION 'INVALID_RETENTION_DAYS' USING ERRCODE = '22023';
  END IF;
END $$;

CREATE FUNCTION public.get_organization_report_configs(p_org_id text)
RETURNS SETOF public.organization_report_configs
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_org uuid := private.parse_uuid_strict(p_org_id);
BEGIN
  IF pg_catalog.current_setting('role', true) = 'service_role' THEN
    IF NOT public.has_org_feature(v_org, 'module_voice_and_reports') THEN
      RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
    END IF;
  ELSE
    PERFORM private.require_report_staff(v_org, ARRAY['super_admin', 'org_admin', 'nurse'], false);
  END IF;
  RETURN QUERY SELECT * FROM public.organization_report_configs
    WHERE organization_id = v_org ORDER BY category_code;
END $$;

CREATE FUNCTION public.upsert_organization_report_category(
  p_org_id text, p_category_code text, p_category_label text, p_classifier_hint text DEFAULT '',
  p_is_enabled text DEFAULT 'true', p_schedule_mode text DEFAULT 'daily',
  p_allowed_sections_json text DEFAULT '["summary","events","action_items"]',
  p_recipient_roles_json text DEFAULT '["org_admin"]', p_requires_approval text DEFAULT 'true',
  p_retention_days text DEFAULT '365', p_archived_at text DEFAULT NULL
) RETURNS public.organization_report_configs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_org uuid := private.parse_uuid_strict(p_org_id);
  v_enabled boolean := private.parse_bool_strict(p_is_enabled);
  v_sections text[] := private.parse_text_array_json_strict(p_allowed_sections_json);
  v_roles text[] := private.parse_text_array_json_strict(p_recipient_roles_json);
  v_days integer := private.parse_int_strict(p_retention_days);
  v_approval boolean := private.parse_bool_strict(p_requires_approval);
  v_archived timestamptz := private.parse_optional_timestamptz_strict(p_archived_at);
  v_row public.organization_report_configs;
BEGIN
  PERFORM private.require_report_staff(v_org, ARRAY['super_admin'], true);
  PERFORM private.validate_report_configuration(p_category_code, p_schedule_mode, v_sections, v_roles, v_days);
  PERFORM private.report_required(p_category_label);
  IF p_classifier_hint IS NULL THEN RAISE EXCEPTION 'MISSING_REQUIRED_PARAMETER' USING ERRCODE = '22023'; END IF;
  IF length(p_category_label) > 160 OR length(p_classifier_hint) > 800 THEN
    RAISE EXCEPTION 'REPORT_CONFIGURATION_TOO_LONG' USING ERRCODE = '22023';
  END IF;
  PERFORM private.assert_no_org_registry_identifiers(v_org, p_category_code);
  PERFORM private.assert_no_org_registry_identifiers(v_org, p_category_label);
  PERFORM private.assert_no_org_registry_identifiers(v_org, p_classifier_hint);
  INSERT INTO public.organization_report_configs
    (organization_id, category_code, category_label, classifier_hint, is_enabled, schedule_mode,
      allowed_sections, recipient_roles, requires_approval, retention_days, archived_at)
  VALUES (v_org, p_category_code, btrim(p_category_label), btrim(p_classifier_hint), v_enabled,
    p_schedule_mode, v_sections, v_roles, v_approval, v_days, v_archived)
  ON CONFLICT (organization_id, category_code) DO UPDATE SET
    category_label = EXCLUDED.category_label, classifier_hint = EXCLUDED.classifier_hint,
    is_enabled = EXCLUDED.is_enabled, schedule_mode = EXCLUDED.schedule_mode,
    allowed_sections = EXCLUDED.allowed_sections, recipient_roles = EXCLUDED.recipient_roles,
    requires_approval = EXCLUDED.requires_approval, retention_days = EXCLUDED.retention_days,
    archived_at = EXCLUDED.archived_at, updated_at = pg_catalog.now()
  RETURNING * INTO v_row;
  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
    VALUES (v_org, 'ORG_REPORT_CATEGORY_UPSERTED', auth.uid(), jsonb_build_object('config_id', v_row.id));
  RETURN v_row;
END $$;

CREATE FUNCTION public.configure_organization_report_category(
  p_org_id text, p_category_code text, p_is_enabled text, p_schedule_mode text,
  p_allowed_sections_json text, p_recipient_roles_json text, p_retention_days text DEFAULT '365'
) RETURNS public.organization_report_configs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_org uuid := private.parse_uuid_strict(p_org_id);
  v_enabled boolean := private.parse_bool_strict(p_is_enabled);
  v_sections text[] := private.parse_text_array_json_strict(p_allowed_sections_json);
  v_roles text[] := private.parse_text_array_json_strict(p_recipient_roles_json);
  v_days integer := private.parse_int_strict(p_retention_days);
  v_row public.organization_report_configs;
BEGIN
  PERFORM private.require_report_staff(v_org, ARRAY['org_admin'], true);
  IF NOT public.has_org_feature(v_org, 'allow_org_admin_report_config') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  PERFORM private.validate_report_configuration(p_category_code, p_schedule_mode, v_sections, v_roles, v_days);
  UPDATE public.organization_report_configs SET
    is_enabled = v_enabled, schedule_mode = p_schedule_mode, allowed_sections = v_sections,
    recipient_roles = v_roles, retention_days = v_days, updated_at = pg_catalog.now()
  WHERE organization_id = v_org AND category_code = p_category_code AND archived_at IS NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_CATEGORY_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
    VALUES (v_org, 'ORG_REPORT_CONFIG_UPDATED', auth.uid(), jsonb_build_object('config_id', v_row.id));
  RETURN v_row;
END $$;

CREATE FUNCTION public.record_voice_sanitized_event(
  p_org_id text, p_draft_note_id text, p_capture_source text, p_scope text, p_resident_id text,
  p_author_id text, p_sanitized_text text, p_matched_categories_json text, p_recorded_at text, p_metadata_json text
) RETURNS public.voice_sanitized_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_org uuid; v_draft uuid; v_resident uuid; v_author uuid; v_segment uuid;
  v_categories text[]; v_recorded timestamptz; v_metadata jsonb;
  v_row public.voice_sanitized_events;
BEGIN
  PERFORM private.require_report_service();
  v_org := private.parse_uuid_strict(p_org_id);
  v_draft := private.parse_optional_uuid_strict(p_draft_note_id);
  v_resident := private.parse_optional_uuid_strict(p_resident_id);
  v_author := private.parse_uuid_strict(p_author_id);
  v_categories := private.parse_text_array_json_strict(p_matched_categories_json);
  v_recorded := private.parse_timestamptz_strict(p_recorded_at);
  v_metadata := private.parse_jsonb_strict(p_metadata_json);
  IF NOT public.has_org_feature(v_org, 'module_voice_and_reports') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_metadata) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_each(v_metadata) e
    WHERE e.key NOT IN ('pipeline_stage', 'capture_device_id', 'assignment_id', 'segment_id')
      OR jsonb_typeof(e.value) <> 'string'
  ) OR COALESCE(v_metadata->>'pipeline_stage', '') NOT IN ('REDACT', 'CLASSIFY') THEN
    RAISE EXCEPTION 'INVALID_EVENT_METADATA' USING ERRCODE = '22023';
  END IF;
  PERFORM private.parse_optional_uuid_strict(v_metadata->>'capture_device_id');
  PERFORM private.parse_optional_uuid_strict(v_metadata->>'assignment_id');
  v_segment := private.parse_optional_uuid_strict(v_metadata->>'segment_id');
  IF private.report_required(p_capture_source) NOT IN ('APP', 'APP_GENERAL', 'DEVICE')
    OR private.report_required(p_scope) NOT IN ('resident', 'facility')
    OR (p_scope = 'resident') <> (v_resident IS NOT NULL)
    OR (p_capture_source = 'APP' AND p_scope <> 'resident') THEN
    RAISE EXCEPTION 'INVALID_CAPTURE_SCOPE' USING ERRCODE = '23514';
  END IF;
  IF p_capture_source <> 'APP' AND v_segment IS NULL THEN
    RAISE EXCEPTION 'DEVICE_ASSIGNMENT_QUEUE_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;
  IF (v_metadata->>'pipeline_stage' = 'REDACT' AND cardinality(v_categories) > 0)
    OR EXISTS (SELECT 1 FROM unnest(v_categories) c WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_report_configs r WHERE r.organization_id = v_org
        AND r.category_code = c AND r.is_enabled AND r.archived_at IS NULL
    )) THEN RAISE EXCEPTION 'INVALID_EVENT_STAGE_CATEGORIES' USING ERRCODE = '23514'; END IF;
  PERFORM private.report_required(p_sanitized_text);
  PERFORM private.assert_no_org_registry_identifiers(v_org, p_sanitized_text);

  IF v_resident IS NOT NULL THEN
    PERFORM id FROM public.residents WHERE id = v_resident AND organization_id = v_org
      AND archived_at IS NULL FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_EVENT_RESIDENT' USING ERRCODE = '23514'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_author
    AND raw_app_meta_data->>'organization_id' = v_org::text
    AND raw_app_meta_data->>'role' IN ('nurse', 'org_admin')) THEN
    RAISE EXCEPTION 'INVALID_EVENT_AUTHOR' USING ERRCODE = '23514';
  END IF;
  IF v_draft IS NOT NULL THEN
    PERFORM id FROM public.voice_draft_notes WHERE id = v_draft
      AND resident_id = v_resident AND nurse_id = v_author FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_EVENT_DRAFT_NOTE' USING ERRCODE = '23514'; END IF;
  END IF;
  IF v_segment IS NOT NULL THEN
    PERFORM s.id FROM public.voice_segments s JOIN public.voice_captures c ON c.id = s.capture_id
    WHERE s.id = v_segment AND s.organization_id = v_org AND c.source = p_capture_source
      AND s.resident_id IS NOT DISTINCT FROM v_resident AND s.author_id = v_author
      AND s.assignment_status = upper(p_scope)
      AND c.recorded_at = v_recorded
      AND (v_metadata->>'capture_device_id' IS NULL OR c.device_id::text = v_metadata->>'capture_device_id')
    FOR KEY SHARE OF s;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_EVENT_SEGMENT' USING ERRCODE = '23514'; END IF;
  END IF;

  INSERT INTO public.voice_sanitized_events
    (organization_id, draft_note_id, segment_id, capture_source, scope, resident_id, author_id,
      sanitized_text, matched_categories, recorded_at, metadata)
  VALUES (v_org, v_draft, v_segment, p_capture_source, p_scope, v_resident, v_author,
    p_sanitized_text, v_categories, v_recorded, v_metadata)
  ON CONFLICT DO NOTHING RETURNING * INTO v_row;
  IF FOUND THEN RETURN v_row; END IF;
  SELECT * INTO v_row FROM public.voice_sanitized_events
    WHERE organization_id = v_org AND (draft_note_id = v_draft OR segment_id = v_segment)
    ORDER BY id LIMIT 1;
  IF v_row.id IS NOT NULL AND ROW(v_row.draft_note_id, v_row.segment_id, v_row.capture_source, v_row.scope,
    v_row.resident_id, v_row.author_id, v_row.sanitized_text, v_row.matched_categories, v_row.recorded_at, v_row.metadata)
    IS NOT DISTINCT FROM ROW(v_draft, v_segment, p_capture_source, p_scope, v_resident, v_author,
      p_sanitized_text, v_categories, v_recorded, v_metadata) THEN RETURN v_row; END IF;
  RAISE EXCEPTION 'DUPLICATE_SANITIZED_EVENT_CONFLICT' USING ERRCODE = '23505';
END $$;

CREATE FUNCTION private.lock_operational_report_writes(p_org uuid) RETURNS void
LANGUAGE sql SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('op_reports_write:' || p_org::text, 0))
$$;

CREATE FUNCTION private.validate_operational_report_content(
  p_org uuid, p_content jsonb, p_sections text[], p_sources uuid[]
) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_section text; v_item jsonb; v_event uuid;
BEGIN
  IF jsonb_typeof(p_content) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_REPORT_CONTENT_KEYS' USING ERRCODE = '22023';
  END IF;
  IF ARRAY(SELECT key FROM jsonb_object_keys(p_content) key ORDER BY key) IS DISTINCT FROM
    ARRAY(SELECT DISTINCT key FROM unnest(ARRAY['no_data', 'summary'] || p_sections) key ORDER BY key) THEN
    RAISE EXCEPTION 'INVALID_REPORT_CONTENT_KEYS' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_content->'no_data') <> 'boolean' OR jsonb_typeof(p_content->'summary') <> 'string'
    OR btrim(p_content->>'summary') = '' THEN
    RAISE EXCEPTION 'INVALID_REPORT_SECTION_SHAPE' USING ERRCODE = '22023';
  END IF;
  PERFORM private.assert_no_org_registry_identifiers(p_org, p_content->>'summary');
  FOREACH v_section IN ARRAY p_sections LOOP
    IF v_section = 'summary' THEN CONTINUE; END IF;
    IF jsonb_typeof(p_content->v_section) <> 'array' THEN
      RAISE EXCEPTION 'INVALID_REPORT_SECTION_SHAPE' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_content->v_section) LOOP
      IF v_section <> 'source_quotes' THEN
        IF jsonb_typeof(v_item) <> 'string' OR btrim(v_item #>> '{}') = '' THEN
          RAISE EXCEPTION 'INVALID_REPORT_SECTION_SHAPE' USING ERRCODE = '22023';
        END IF;
        PERFORM private.assert_no_org_registry_identifiers(p_org, v_item #>> '{}');
      ELSE
        IF jsonb_typeof(v_item) <> 'object' THEN
          RAISE EXCEPTION 'INVALID_SOURCE_QUOTE_SHAPE' USING ERRCODE = '22023';
        END IF;
        IF ARRAY(SELECT key FROM jsonb_object_keys(v_item) key ORDER BY key) <> ARRAY['event_id', 'quote']
          OR jsonb_typeof(v_item->'event_id') <> 'string' OR jsonb_typeof(v_item->'quote') <> 'string'
          OR btrim(v_item->>'quote') = '' THEN
          RAISE EXCEPTION 'INVALID_SOURCE_QUOTE_SHAPE' USING ERRCODE = '22023';
        END IF;
        BEGIN
          v_event := private.parse_uuid_strict(v_item->>'event_id');
        EXCEPTION WHEN SQLSTATE '22023' THEN
          RAISE EXCEPTION 'INVALID_SOURCE_QUOTE_SHAPE' USING ERRCODE = '22023';
        END;
        IF NOT v_event = ANY(p_sources) THEN
          RAISE EXCEPTION 'INVALID_SOURCE_QUOTE_SHAPE' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.voice_sanitized_events
          WHERE id = v_event AND strpos(sanitized_text, v_item->>'quote') > 0) THEN
          RAISE EXCEPTION 'UNGROUNDED_SOURCE_QUOTE' USING ERRCODE = '23514';
        END IF;
        PERFORM private.assert_no_org_registry_identifiers(p_org, v_item->>'quote');
      END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE FUNCTION private.operational_report_placeholder(
  p_no_data boolean, p_sections text[], p_quotes jsonb DEFAULT '[]'
) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
  SELECT jsonb_build_object('no_data', p_no_data, 'summary', CASE WHEN p_no_data
     THEN 'Brak zarejestrowanych zdarzeń w wybranym okresie.'
     ELSE 'Raport wymaga ponownego wygenerowania po usunięciu danych źródłowych (RODO art. 17).' END)
    || COALESCE((SELECT jsonb_object_agg(section, CASE WHEN section = 'source_quotes' THEN p_quotes ELSE '[]'::jsonb END)
      FROM unnest(p_sections) section WHERE section <> 'summary'), '{}'::jsonb)
$$;

CREATE FUNCTION public.record_generated_operational_report(
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
    WHERE e.organization_id = v_org AND e.id = ANY(v_source_ids) AND e.recorded_at BETWEEN v_start AND v_end
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
    WHERE e.organization_id = v_org AND e.recorded_at BETWEEN v_start AND v_end
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

CREATE FUNCTION public.approve_operational_report(p_report_id text) RETURNS public.operational_reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_id uuid := private.parse_uuid_strict(p_report_id); v_org uuid; v_row public.operational_reports;
BEGIN
  SELECT organization_id INTO v_org FROM public.operational_reports WHERE id = v_id;
  PERFORM private.require_report_staff(v_org, ARRAY['org_admin', 'nurse'], true);
  PERFORM private.lock_operational_report_writes(v_org);
  SELECT * INTO v_row FROM public.operational_reports WHERE id = v_id ORDER BY id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'REPORT_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF v_row.requires_regeneration THEN RAISE EXCEPTION 'REPORT_REQUIRES_REGENERATION' USING ERRCODE = '23514'; END IF;
  IF v_row.status = 'APPROVED' THEN RAISE EXCEPTION 'REPORT_ALREADY_APPROVED' USING ERRCODE = '23514'; END IF;
  UPDATE public.operational_reports SET
    status = 'APPROVED', approved_by = auth.uid(), approved_at = pg_catalog.now(), updated_at = pg_catalog.now()
  WHERE id = v_id RETURNING * INTO v_row;
  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
    VALUES (v_org, 'OPERATIONAL_REPORT_APPROVED', auth.uid(), jsonb_build_object('report_id', v_row.id));
  RETURN v_row;
END $$;

CREATE FUNCTION private.guard_voice_report_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_retention integer;
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'VOICE_REPORT_DELETE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME = 'organization_report_configs' THEN
    IF EXISTS (SELECT 1 FROM public.organizations WHERE id = OLD.organization_id) THEN
      RAISE EXCEPTION 'REPORT_CATEGORY_DELETE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'voice_sanitized_events' THEN
    IF OLD.resident_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.residents WHERE id = OLD.resident_id) THEN
      RETURN OLD;
    END IF;
    SELECT COALESCE(max(retention_days), 365) INTO v_retention
      FROM public.organization_report_configs WHERE organization_id = OLD.organization_id;
    IF OLD.recorded_at >= pg_catalog.now() - make_interval(days => v_retention)
      OR EXISTS (SELECT 1 FROM public.operational_reports WHERE source_event_ids @> ARRAY[OLD.id]) THEN
      RAISE EXCEPTION 'SANITIZED_EVENT_DELETE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER voice_report_config_delete BEFORE DELETE ON public.organization_report_configs
  FOR EACH ROW EXECUTE FUNCTION private.guard_voice_report_delete();
CREATE TRIGGER voice_report_event_delete BEFORE DELETE ON public.voice_sanitized_events
  FOR EACH ROW EXECUTE FUNCTION private.guard_voice_report_delete();
CREATE TRIGGER operational_report_delete BEFORE DELETE ON public.operational_reports
  FOR EACH ROW EXECUTE FUNCTION private.guard_voice_report_delete();

CREATE FUNCTION private.guard_sanitized_event_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role')
    OR to_jsonb(NEW) - ARRAY['draft_note_id','segment_id'] IS DISTINCT FROM
      to_jsonb(OLD) - ARRAY['draft_note_id','segment_id']
    OR (NEW.draft_note_id IS NOT NULL AND NEW.draft_note_id IS DISTINCT FROM OLD.draft_note_id)
    OR (NEW.segment_id IS NOT NULL AND NEW.segment_id IS DISTINCT FROM OLD.segment_id) THEN
    RAISE EXCEPTION 'SANITIZED_EVENT_UPDATE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER voice_sanitized_event_immutable BEFORE UPDATE ON public.voice_sanitized_events
  FOR EACH ROW EXECUTE FUNCTION private.guard_sanitized_event_update();

CREATE FUNCTION private.trg_prune_deleted_event_from_reports() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE v_row public.operational_reports; v_sections text[]; v_kept uuid[]; v_quotes jsonb;
BEGIN
  IF OLD.resident_id IS NULL OR EXISTS (SELECT 1 FROM public.residents WHERE id = OLD.resident_id) THEN
    RETURN OLD;
  END IF;
  PERFORM private.lock_operational_report_writes(OLD.organization_id);
  FOR v_row IN SELECT * FROM public.operational_reports
    WHERE organization_id = OLD.organization_id AND source_event_ids @> ARRAY[OLD.id]
    ORDER BY id FOR UPDATE LOOP
    SELECT allowed_sections INTO v_sections FROM public.organization_report_configs
      WHERE organization_id = v_row.organization_id AND category_code = v_row.category_code;
    v_kept := array_remove(v_row.source_event_ids, OLD.id);
    SELECT COALESCE(jsonb_agg(q.value ORDER BY q.ord), '[]'::jsonb) INTO v_quotes
      FROM jsonb_array_elements(COALESCE(v_row.content->'source_quotes', '[]')) WITH ORDINALITY q(value, ord)
      WHERE q.value->>'event_id' = ANY(v_kept::text[]);
    UPDATE public.operational_reports SET
      source_event_ids = v_kept,
      content = private.operational_report_placeholder(cardinality(v_kept) = 0, v_sections, v_quotes),
      status = 'DRAFT', requires_regeneration = true, approved_by = NULL, approved_at = NULL,
      ai_model = CASE WHEN cardinality(v_kept) = 0 THEN 'rule-based-no-data-v1' ELSE v_row.ai_model END,
      ai_prompt_version = CASE WHEN cardinality(v_kept) = 0 THEN 'rule-based-no-data-v1' ELSE v_row.ai_prompt_version END,
      updated_at = pg_catalog.now()
    WHERE id = v_row.id;
  END LOOP;
  RETURN OLD;
END $$;
CREATE TRIGGER prune_deleted_sanitized_event AFTER DELETE ON public.voice_sanitized_events
  FOR EACH ROW EXECUTE FUNCTION private.trg_prune_deleted_event_from_reports();

CREATE FUNCTION public.cleanup_expired_operational_reports(p_org_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_target uuid; v_org uuid; v_event_ids uuid[]; v_residents uuid[];
  v_report_count integer := 0; v_event_count integer := 0; v_count integer; v_retention integer;
BEGIN
  PERFORM private.require_report_service();
  IF p_org_id = '' THEN RAISE EXCEPTION 'INVALID_UUID_PARAMETER' USING ERRCODE = '22023'; END IF;
  v_target := private.parse_optional_uuid_strict(p_org_id);
  FOR v_org IN SELECT id FROM public.organizations WHERE v_target IS NULL OR id = v_target ORDER BY id LOOP
    SELECT COALESCE(max(retention_days), 365) INTO v_retention
      FROM public.organization_report_configs WHERE organization_id = v_org;
    SELECT COALESCE(array_agg(id ORDER BY id), '{}'), COALESCE(array_agg(DISTINCT resident_id)
      FILTER (WHERE resident_id IS NOT NULL), '{}') INTO v_event_ids, v_residents
    FROM public.voice_sanitized_events WHERE organization_id = v_org
      AND recorded_at < pg_catalog.now() - make_interval(days => v_retention);
    PERFORM id FROM public.residents WHERE id = ANY(v_residents) ORDER BY id FOR KEY SHARE;
    PERFORM id FROM public.voice_sanitized_events WHERE id = ANY(v_event_ids) ORDER BY id FOR UPDATE;
    PERFORM private.lock_operational_report_writes(v_org);
    WITH expired AS MATERIALIZED (
      SELECT r.id FROM public.operational_reports r
      JOIN public.organization_report_configs c ON c.organization_id = r.organization_id AND c.category_code = r.category_code
      WHERE r.organization_id = v_org AND r.period_end < pg_catalog.now() - make_interval(days => c.retention_days)
      ORDER BY r.id FOR UPDATE OF r
    )
    DELETE FROM public.operational_reports WHERE id IN (SELECT id FROM expired);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_report_count := v_report_count + v_count;
    DELETE FROM public.voice_sanitized_events e WHERE e.id = ANY(v_event_ids)
      AND NOT EXISTS (SELECT 1 FROM public.operational_reports r WHERE r.source_event_ids @> ARRAY[e.id]);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_event_count := v_event_count + v_count;
  END LOOP;
  RETURN jsonb_build_object('reports_deleted', v_report_count, 'events_deleted', v_event_count);
END $$;

DO $$
DECLARE v_fn record;
BEGIN
  FOR v_fn IN SELECT n.nspname schema_name, p.proname function_name, pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname = 'private' AND p.proname = ANY(ARRAY[
      'report_required', 'parse_uuid_strict', 'parse_optional_uuid_strict', 'parse_int_strict', 'parse_bool_strict',
      'parse_timestamptz_strict', 'parse_optional_timestamptz_strict', 'parse_jsonb_strict',
      'parse_text_array_json_strict', 'parse_uuid_array_json_strict', 'require_report_service', 'require_report_staff',
      'assert_no_org_registry_identifiers', 'seed_report_categories', 'seed_report_categories_after_organization',
      'validate_report_configuration', 'lock_operational_report_writes', 'validate_operational_report_content',
      'operational_report_placeholder', 'guard_voice_report_delete', 'guard_sanitized_event_update',
      'trg_prune_deleted_event_from_reports'
    ])) OR (n.nspname = 'public' AND p.proname = ANY(ARRAY[
      'get_organization_report_configs', 'upsert_organization_report_category', 'configure_organization_report_category',
      'record_voice_sanitized_event', 'record_generated_operational_report', 'approve_operational_report',
      'cleanup_expired_operational_reports'
    ]))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated, service_role',
      v_fn.schema_name, v_fn.function_name, v_fn.args);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.get_organization_report_configs(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_organization_report_category(text,text,text,text,text,text,text,text,text,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.configure_organization_report_category(text,text,text,text,text,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_operational_report(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_voice_sanitized_event(text,text,text,text,text,text,text,text,text,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_generated_operational_report(text,text,text,text,text,text,text,text,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_operational_reports(text) TO service_role;
NOTIFY pgrst, 'reload schema';
