-- @REQ: NUR-SHIFT-CLOSURE
CREATE OR REPLACE FUNCTION private.shift_handover_draft(p_shift public.shift_definitions, p_date date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_next public.shift_definitions;
  v_next_date date := p_date;
  v_latest integer;
  v_voice jsonb := '{"facts":[],"receipts":[],"exceptions":0,"unknownAuthors":0,"pendingSources":0}';
  v_tasks jsonb;
  v_new_receipts integer;
  v_late_task_ids jsonb := '[]'::jsonb;
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

  IF v_latest IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(t->>'id' ORDER BY t->>'id'), '[]'::jsonb) INTO v_late_task_ids
    FROM jsonb_array_elements(v_tasks) t
    WHERE t->>'status' = 'TODO' AND t->>'carriedToTaskId' IS NULL;
  END IF;

  RETURN v_voice || jsonb_build_object('latestVersion', v_latest,
    'nextShift', jsonb_build_object('id', v_next.id, 'code', v_next.code, 'name', v_next.name, 'date', v_next_date),
    'tasks', v_tasks, 'lateTaskIds', v_late_task_ids, 'newReceipts', v_new_receipts, 'canApprove', v_next.id IS NOT NULL
      AND (v_latest IS NULL OR jsonb_array_length(v_voice->'facts') > 0 OR v_new_receipts > 0 OR jsonb_array_length(v_late_task_ids) > 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_shift_handover(
  p_shift uuid, p_date date, p_revision text, p_completeness text, p_reason text, p_expected_source_ids uuid[]
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_shift public.shift_definitions := private.require_shift_handover_scope(p_shift, p_date);
  v_draft jsonb;
  v_previous integer;
  v_version integer;
  v_next uuid;
  v_next_date date;
  v_task record;
  v_facts jsonb;
  v_task_states jsonb;
  v_carried jsonb := '{}'::jsonb;
  v_copy uuid;
  v_received uuid[];
  v_expected uuid[] := COALESCE(p_expected_source_ids, ARRAY[]::uuid[]);
  v_reason text := nullif(btrim(p_reason), '');
BEGIN
  PERFORM private.lock_shift_handover(p_shift, p_date);
  PERFORM id FROM public.shift_tasks
    WHERE organization_id = v_shift.organization_id AND shift_definition_id = p_shift AND shift_date = p_date
    ORDER BY id FOR UPDATE;

  v_draft := private.shift_handover_draft(v_shift, p_date);
  IF p_revision IS DISTINCT FROM private.shift_handover_revision(v_draft) THEN
    RAISE EXCEPTION 'SHIFT_HANDOVER_STALE' USING ERRCODE = '23514';
  END IF;
  IF (v_draft->>'canApprove')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'SHIFT_HANDOVER_NO_CHANGES' USING ERRCODE = '23514';
  END IF;
  IF p_completeness IS NULL OR p_completeness NOT IN ('COMPLETE', 'PARTIAL', 'UNKNOWN') THEN
    RAISE EXCEPTION 'SHIFT_HANDOVER_INVALID_COMPLETENESS' USING ERRCODE = '22023';
  END IF;
  IF p_completeness = 'COMPLETE' THEN
    v_expected := ARRAY(SELECT DISTINCT id FROM unnest(v_expected) AS id ORDER BY id);
    IF cardinality(v_expected) = 0 OR cardinality(v_expected) > 500 OR (v_draft->>'exceptions')::integer > 0
      OR (v_draft->>'pendingSources')::integer > 0
      OR v_expected IS DISTINCT FROM ARRAY(
        SELECT (receipt->>'sourceKey')::uuid FROM jsonb_array_elements(v_draft->'receipts') receipt
        ORDER BY (receipt->>'sourceKey')::uuid
      ) THEN
      RAISE EXCEPTION 'SHIFT_HANDOVER_EVIDENCE_REQUIRED' USING ERRCODE = '23514';
    END IF;
    v_reason := NULL;
  ELSE
    IF v_reason IS NULL OR length(v_reason) > 500 THEN
      RAISE EXCEPTION 'SHIFT_HANDOVER_REASON_REQUIRED' USING ERRCODE = '23514';
    END IF;
    v_expected := ARRAY[]::uuid[];
  END IF;

  v_previous := (v_draft->>'latestVersion')::integer;
  v_version := COALESCE(v_previous, 0) + 1;
  v_next := (v_draft->'nextShift'->>'id')::uuid;
  v_next_date := (v_draft->'nextShift'->>'date')::date;
  FOR v_task IN SELECT (t->>'id')::uuid AS id FROM jsonb_array_elements(v_draft->'tasks') t
    WHERE t->>'status' = 'TODO' AND t->>'carriedToTaskId' IS NULL
  LOOP
    v_copy := public.settle_shift_task(v_task.id, 'CARRIED', NULL, v_next, v_next_date);
    v_carried := v_carried || jsonb_build_object(v_task.id::text, v_copy);
  END LOOP;
  SELECT COALESCE(jsonb_agg(f - 'text' ORDER BY ord), '[]'::jsonb) INTO v_facts
    FROM jsonb_array_elements(v_draft->'facts') WITH ORDINALITY AS fact(f, ord);

  SELECT COALESCE(jsonb_agg(
    CASE WHEN v_carried ? (t->>'id') THEN t || jsonb_build_object('carriedToTaskId', v_carried->(t->>'id')) ELSE t END
      ORDER BY ord), '[]'::jsonb) INTO v_task_states
    FROM jsonb_array_elements(v_draft->'tasks') WITH ORDINALITY AS task(t, ord);

  v_received := ARRAY(SELECT (receipt->>'id')::uuid FROM jsonb_array_elements(v_draft->'receipts') receipt);

  INSERT INTO private.shift_handover_versions
    (organization_id, shift_definition_id, shift_date, version, previous_version, completeness, partial_reason,
     expected_source_ids, received_source_ids, facts, task_states, next_shift_definition_id, next_shift_date, approved_by)
  VALUES (v_shift.organization_id, p_shift, p_date, v_version, v_previous, p_completeness, v_reason,
     v_expected, v_received, v_facts, v_task_states, v_next, v_next_date, auth.uid());

  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (v_shift.organization_id,
    CASE WHEN v_previous IS NULL THEN 'SHIFT_HANDOVER_APPROVED' ELSE 'SHIFT_HANDOVER_AMENDMENT_APPROVED' END,
    auth.uid(), jsonb_build_object('shift_definition_id', p_shift, 'shift_date', p_date, 'version', v_version,
      'previous_version', v_previous, 'completeness', p_completeness, 'next_shift_definition_id', v_next,
      'next_shift_date', v_next_date, 'expected_source_ids', v_expected, 'received_source_ids', v_received,
      'fact_ids', (SELECT COALESCE(jsonb_agg(f->>'id'), '[]'::jsonb) FROM jsonb_array_elements(v_facts) f)));
  RETURN v_version;
END;
$$;
