-- @REQ: NUR-SHIFT-CLOSURE
-- Zatwierdzenia są niezmienne. Fakty pozostają w źródłowym rejestrze z jego retencją.
CREATE TABLE private.shift_handover_versions (
  organization_id uuid NOT NULL,
  shift_definition_id uuid NOT NULL,
  shift_date date NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  previous_version integer CHECK (previous_version = version - 1),
  completeness text NOT NULL CHECK (completeness IN ('COMPLETE', 'PARTIAL', 'UNKNOWN')),
  partial_reason text,
  expected_source_ids uuid[] NOT NULL,
  received_source_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  facts jsonb NOT NULL,
  task_states jsonb NOT NULL,
  next_shift_definition_id uuid NOT NULL,
  next_shift_date date NOT NULL,
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (organization_id, shift_definition_id, shift_date, version),
  FOREIGN KEY (shift_definition_id, organization_id) REFERENCES public.shift_definitions(id, organization_id),
  FOREIGN KEY (next_shift_definition_id, organization_id) REFERENCES public.shift_definitions(id, organization_id),
  FOREIGN KEY (organization_id, shift_definition_id, shift_date, previous_version)
    REFERENCES private.shift_handover_versions (organization_id, shift_definition_id, shift_date, version),
  CHECK ((version = 1) = (previous_version IS NULL)),
  CHECK (completeness = 'COMPLETE' OR length(trim(coalesce(partial_reason, ''))) BETWEEN 1 AND 500)
);
ALTER TABLE private.shift_handover_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.shift_handover_versions FROM PUBLIC, anon, authenticated, service_role;

-- App metadata and received captures are read within the selected shift interval.
CREATE INDEX app_voice_task_recording_handover_time ON private.app_voice_task_recordings (recorded_at);
CREATE INDEX voice_captures_handover_time ON public.voice_captures (organization_id, recorded_at);

CREATE FUNCTION private.require_shift_handover_scope(p_shift uuid, p_date date)
RETURNS public.shift_definitions
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_org uuid := public.get_jwt_organization_id();
  v_role text := auth.jwt()->'app_metadata'->>'role';
  v_shift public.shift_definitions;
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL OR p_date IS NULL OR NOT isfinite(p_date)
    OR NOT public.staff_mfa_satisfied()
    OR auth.jwt()->'app_metadata'->>'impersonator_id' IS NOT NULL
    OR NOT public.has_org_feature(v_org, 'module_shift_tasks')
    OR (v_role = 'org_admin' OR (v_role = 'nurse' AND public.is_shift_lead(p_shift, p_date))) IS NOT TRUE THEN
    RAISE EXCEPTION 'SHIFT_HANDOVER_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_shift FROM public.shift_definitions WHERE id = p_shift AND organization_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIFT_HANDOVER_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN v_shift;
END;
$$;

CREATE FUNCTION private.shift_handover_voice(
  p_org uuid, p_shift uuid, p_date date, p_start timestamptz, p_end timestamptz
) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH material AS (
    SELECT e.id, e.capture_source AS source, e.recorded_at,
      COALESCE(c.received_at, app.received_at, e.created_at) AS received_at,
      COALESCE(e.segment_id, e.draft_note_id, e.id) AS source_id,
      COALESCE(s.author_attribution, CASE WHEN e.capture_source = 'APP' THEN 'AUTHENTICATED_SESSION' END, 'UNKNOWN') AS attribution,
      e.sanitized_text, e.resident_id, 'event' AS kind
    FROM public.voice_sanitized_events e
    LEFT JOIN public.voice_segments s ON s.id = e.segment_id AND s.organization_id = e.organization_id
    LEFT JOIN public.voice_captures c ON c.id = s.capture_id AND c.organization_id = e.organization_id
    LEFT JOIN private.app_voice_task_recordings app ON app.draft_id = e.draft_note_id
    WHERE e.organization_id = p_org AND e.recorded_at >= p_start AND e.recorded_at < p_end
    UNION ALL
    SELECT p.segment_id, c.source, p.recorded_at, c.received_at, p.segment_id, s.author_attribution,
      array_to_string(p.behavioral_facts, E'\n'), p.resident_id, 'behavior'
    FROM public.voice_segment_proposals p
    JOIN public.voice_segments s ON s.id = p.segment_id AND s.organization_id = p.organization_id
    JOIN public.voice_captures c ON c.id = p.capture_id AND c.organization_id = p.organization_id
    WHERE p.organization_id = p_org AND p.recorded_at >= p_start AND p.recorded_at < p_end
      AND s.assignment_status = 'RESIDENT' AND s.projection_status = 'READY'
      AND cardinality(p.behavioral_facts) > 0
  ), facts AS (
    SELECT * FROM material m WHERE NOT EXISTS (
      SELECT 1 FROM private.shift_handover_versions v CROSS JOIN LATERAL jsonb_array_elements(v.facts) f
      WHERE v.organization_id = p_org AND v.shift_definition_id = p_shift AND v.shift_date = p_date
        AND f->>'id' = m.id::text AND COALESCE(f->>'kind', 'event') = m.kind
    )
  ), capture_states AS (
    SELECT c.id, c.source, c.received_at,
      c.status = 'SEGMENTED' AND c.clock_state <> 'UNKNOWN' AS ready
    FROM public.voice_captures c
    WHERE c.organization_id = p_org AND c.recorded_at >= p_start AND c.recorded_at < p_end
    UNION ALL
    SELECT a.draft_id, 'APP', a.received_at, j.completed_at IS NOT NULL
    FROM private.app_voice_task_recordings a JOIN public.voice_draft_notes d ON d.id = a.draft_id
    JOIN public.residents r ON r.id = d.resident_id AND r.organization_id = p_org
    LEFT JOIN public.voice_app_report_jobs j ON j.draft_id = a.draft_id
    WHERE a.recorded_at >= p_start AND a.recorded_at < p_end
  ), exceptions AS (
    SELECT q.segment_id, 'NO_AUTHOR' = ANY(q.reasons) AS unknown_author
    FROM public.voice_assignment_queue q
    WHERE q.organization_id = p_org AND q.decided_at IS NULL
      AND q.shift_definition_id = p_shift AND q.shift_date = p_date
  )
  SELECT jsonb_build_object(
    'facts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'source', source, 'recordedAt', recorded_at, 'receivedAt', received_at,
      'sourceId', source_id, 'attribution', attribution, 'text', sanitized_text, 'residentId', resident_id, 'kind', kind
    ) ORDER BY recorded_at, id) FROM facts), '[]'::jsonb),
    'receipts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'source', source, 'receivedAt', received_at
    ) ORDER BY received_at, id) FROM capture_states WHERE ready), '[]'::jsonb),
    'pendingSources', (SELECT count(*) FROM capture_states WHERE NOT ready),
    'exceptions', (SELECT count(*) FROM exceptions),
    'unknownAuthors', (SELECT count(*) FROM exceptions WHERE unknown_author)
  )
$$;

CREATE FUNCTION private.shift_handover_draft(p_shift public.shift_definitions, p_date date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_next public.shift_definitions;
  v_next_date date := p_date;
  v_latest integer;
  v_voice jsonb := '{"facts":[],"receipts":[],"exceptions":0,"unknownAuthors":0,"pendingSources":0}';
  v_tasks jsonb;
  v_new_receipts integer;
BEGIN
  SELECT * INTO v_next FROM public.shift_definitions d
  WHERE d.organization_id = p_shift.organization_id AND d.is_active AND d.start_time > p_shift.start_time
  ORDER BY d.start_time, d.order_index, d.id LIMIT 1;
  IF NOT FOUND THEN
    SELECT * INTO v_next FROM public.shift_definitions d
    WHERE d.organization_id = p_shift.organization_id AND d.is_active
    ORDER BY d.start_time, d.order_index, d.id LIMIT 1;
    v_next_date := p_date + 1;
  END IF;

  SELECT max(version) INTO v_latest FROM private.shift_handover_versions
    WHERE organization_id = p_shift.organization_id AND shift_definition_id = p_shift.id AND shift_date = p_date;
  IF public.has_org_feature(p_shift.organization_id, 'module_voice_and_reports') THEN
    v_voice := private.shift_handover_voice(p_shift.organization_id, p_shift.id, p_date,
      (p_date + p_shift.start_time) AT TIME ZONE 'Europe/Warsaw',
      (p_date + (p_shift.end_time <= p_shift.start_time)::integer + p_shift.end_time) AT TIME ZONE 'Europe/Warsaw');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'status', t.status,
    'updatedAt', t.updated_at, 'assigneeId', t.assignee_user_id, 'carriedToTaskId',
    (SELECT n.id FROM public.shift_tasks n WHERE n.carried_from_task_id = t.id
       AND n.organization_id = p_shift.organization_id ORDER BY n.id LIMIT 1))
    ORDER BY t.id), '[]'::jsonb) INTO v_tasks
  FROM public.shift_tasks t
  WHERE t.organization_id = p_shift.organization_id AND t.shift_definition_id = p_shift.id AND t.shift_date = p_date;
  SELECT count(*) INTO v_new_receipts FROM jsonb_array_elements(v_voice->'receipts') receipt
    WHERE NOT EXISTS (SELECT 1 FROM private.shift_handover_versions v
      WHERE v.organization_id = p_shift.organization_id AND v.shift_definition_id = p_shift.id AND v.shift_date = p_date
        AND (receipt->>'id')::uuid = ANY(v.received_source_ids));

  RETURN v_voice || jsonb_build_object('latestVersion', v_latest,
    'nextShift', jsonb_build_object('id', v_next.id, 'code', v_next.code, 'name', v_next.name, 'date', v_next_date),
    'tasks', v_tasks, 'newReceipts', v_new_receipts, 'canApprove', v_next.id IS NOT NULL
      AND (v_latest IS NULL OR jsonb_array_length(v_voice->'facts') > 0 OR v_new_receipts > 0));
END;
$$;

REVOKE ALL ON FUNCTION private.require_shift_handover_scope(uuid,date),
  private.shift_handover_voice(uuid,uuid,date,timestamptz,timestamptz),
  private.shift_handover_draft(public.shift_definitions,date) FROM PUBLIC, anon, authenticated, service_role;
