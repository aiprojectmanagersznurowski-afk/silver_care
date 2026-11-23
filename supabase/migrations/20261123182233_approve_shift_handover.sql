-- @REQ: NUR-SHIFT-CLOSURE
CREATE FUNCTION private.shift_handover_revision(p_draft jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(sha256(convert_to(p_draft::text, 'UTF8')), 'hex')
$$;

CREATE FUNCTION private.lock_shift_handover(p_shift uuid, p_date date) RETURNS void
LANGUAGE sql SET search_path = '' AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('shift-handover:' || p_shift || ':' || p_date, 0))
$$;

CREATE FUNCTION private.lock_shift_handover_task_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.lock_shift_handover(NEW.shift_definition_id, NEW.shift_date);
  RETURN NEW;
END;
$$;

-- An approval locks the shift's existing tasks. This lock covers inserts during the same window.
CREATE TRIGGER shift_handover_task_insert_lock BEFORE INSERT ON public.shift_tasks
FOR EACH ROW EXECUTE FUNCTION private.lock_shift_handover_task_insert();

CREATE FUNCTION private.shift_handover_versions_json(p_org uuid, p_shift uuid, p_date date)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'version', v.version, 'previousVersion', v.previous_version, 'completeness', v.completeness,
    'reason', v.partial_reason, 'approvedAt', v.approved_at, 'approvedBy', v.approved_by,
    'tasks', v.task_states, 'expectedSourceIds', to_jsonb(v.expected_source_ids), 'nextDate', v.next_shift_date,
    'facts', (SELECT COALESCE(jsonb_agg(f || jsonb_build_object(
      'text', COALESCE(e.sanitized_text, array_to_string(p.behavioral_facts, E'\n'))) ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(v.facts) WITH ORDINALITY AS fact(f, ord)
      LEFT JOIN public.voice_sanitized_events e
        ON e.id = (f->>'id')::uuid AND e.organization_id = p_org AND COALESCE(f->>'kind', 'event') = 'event'
        AND public.has_org_feature(p_org, 'module_voice_and_reports')
      LEFT JOIN public.voice_segment_proposals p
        ON p.segment_id = (f->>'id')::uuid AND p.organization_id = p_org AND f->>'kind' = 'behavior'
        AND public.has_org_feature(p_org, 'module_voice_and_reports'))
  ) ORDER BY v.version DESC), '[]'::jsonb)
  FROM private.shift_handover_versions v
  WHERE v.organization_id = p_org AND v.shift_definition_id = p_shift AND v.shift_date = p_date
$$;

CREATE FUNCTION public.preview_shift_handover(p_shift uuid, p_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_shift public.shift_definitions := private.require_shift_handover_scope(p_shift, p_date);
  v_draft jsonb := private.shift_handover_draft(v_shift, p_date);
BEGIN
  RETURN v_draft || jsonb_build_object('revision', private.shift_handover_revision(v_draft),
    'versions', private.shift_handover_versions_json(v_shift.organization_id, p_shift, p_date));
END;
$$;

CREATE FUNCTION public.approve_shift_handover(
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
    IF cardinality(v_expected) = 0 OR cardinality(v_expected) > 500 OR (v_draft->>'exceptions')::integer > 0
      OR (v_draft->>'pendingSources')::integer > 0
      OR EXISTS (SELECT 1 FROM unnest(v_expected) id WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_draft->'receipts') receipt WHERE (receipt->>'id')::uuid = id
      )) THEN
      RAISE EXCEPTION 'SHIFT_HANDOVER_EVIDENCE_REQUIRED' USING ERRCODE = '23514';
    END IF;
    v_expected := ARRAY(SELECT DISTINCT id FROM unnest(v_expected) AS id ORDER BY id);
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
  IF v_previous IS NULL THEN
    FOR v_task IN SELECT (t->>'id')::uuid AS id FROM jsonb_array_elements(v_draft->'tasks') t
      WHERE t->>'status' = 'TODO' AND t->>'carriedToTaskId' IS NULL
    LOOP
      v_copy := public.settle_shift_task(v_task.id, 'CARRIED', NULL, v_next, v_next_date);
      v_carried := v_carried || jsonb_build_object(v_task.id::text, v_copy);
    END LOOP;
  END IF;
  SELECT COALESCE(jsonb_agg(f - 'text' ORDER BY ord), '[]'::jsonb) INTO v_facts
    FROM jsonb_array_elements(v_draft->'facts') WITH ORDINALITY AS fact(f, ord);

  SELECT COALESCE(jsonb_agg(
    CASE WHEN v_carried ? (t->>'id') THEN t || jsonb_build_object('carriedToTaskId', v_carried->(t->>'id')) ELSE t END
      ORDER BY ord), '[]'::jsonb) INTO v_task_states
    FROM jsonb_array_elements(v_draft->'tasks') WITH ORDINALITY AS task(t, ord);

  INSERT INTO private.shift_handover_versions
    (organization_id, shift_definition_id, shift_date, version, previous_version, completeness, partial_reason,
     expected_source_ids, facts, task_states, next_shift_definition_id, next_shift_date, approved_by)
  VALUES (v_shift.organization_id, p_shift, p_date, v_version, v_previous, p_completeness, v_reason,
     v_expected, v_facts, v_task_states, v_next, v_next_date, auth.uid());

  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (v_shift.organization_id,
    CASE WHEN v_previous IS NULL THEN 'SHIFT_HANDOVER_APPROVED' ELSE 'SHIFT_HANDOVER_AMENDMENT_APPROVED' END,
    auth.uid(), jsonb_build_object('shift_definition_id', p_shift, 'shift_date', p_date, 'version', v_version,
      'previous_version', v_previous, 'completeness', p_completeness, 'next_shift_definition_id', v_next,
      'next_shift_date', v_next_date, 'expected_source_ids', v_expected,
      'fact_ids', (SELECT COALESCE(jsonb_agg(f->>'id'), '[]'::jsonb) FROM jsonb_array_elements(v_facts) f)));
  RETURN v_version;
END;
$$;

REVOKE ALL ON FUNCTION private.shift_handover_revision(jsonb), private.shift_handover_versions_json(uuid,uuid,date),
  private.lock_shift_handover(uuid,date), private.lock_shift_handover_task_insert()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.preview_shift_handover(uuid,date),
  public.approve_shift_handover(uuid,date,text,text,text,uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_shift_handover(uuid,date),
  public.approve_shift_handover(uuid,date,text,text,text,uuid[]) TO authenticated;
