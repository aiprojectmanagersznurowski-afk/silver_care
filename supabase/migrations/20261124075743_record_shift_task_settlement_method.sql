-- @REQ: NUR-SHIFT-CLOSURE
-- @REQ: NUR-TASKS-VOICE-COMPLETION
CREATE OR REPLACE FUNCTION public.audit_shift_task_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_payload jsonb;
  v_voice record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_payload := jsonb_build_object('task_id', NEW.id, 'from', OLD.status, 'to', NEW.status,
    'shift_definition_id', NEW.shift_definition_id, 'shift_date', NEW.shift_date);
  IF NEW.status IN ('DONE', 'CANCELLED') THEN
    SELECT s.id, s.source_id, s.source_kind, s.fragment_index INTO v_voice
    FROM public.shift_task_voice_suggestions s
    WHERE s.organization_id = OLD.organization_id AND s.shift_definition_id = OLD.shift_definition_id
      AND s.shift_date = OLD.shift_date AND s.task_id = OLD.id AND s.task_updated_at = OLD.updated_at
      AND s.decision = NEW.status AND s.decided_by = auth.uid() AND s.result_task_id IS NULL;
    IF FOUND THEN
      v_payload := v_payload || jsonb_build_object('settlement_method', 'VOICE', 'evidence_id', v_voice.id,
        'source_id', v_voice.source_id, 'source_kind', v_voice.source_kind, 'fragment_index', v_voice.fragment_index);
    ELSE
      v_payload := v_payload || jsonb_build_object('settlement_method', 'MANUAL');
    END IF;
  END IF;
  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, created_at, payload)
  VALUES (NEW.organization_id, NEW.resident_id, 'SHIFT_TASK_STATUS_CHANGED', auth.uid(), clock_timestamp(), v_payload);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_shift_task_voice_suggestion(
  p_evidence_id uuid, p_decision text, p_reason text, p_target_definition_id uuid, p_target_date date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_org uuid := public.get_jwt_organization_id();
  v_evidence public.shift_task_voice_suggestions;
  v_task public.shift_tasks;
  v_result uuid;
  v_decided_at timestamptz;
BEGIN
  PERFORM private.require_report_staff(v_org, ARRAY['org_admin','nurse'], true);
  SELECT * INTO v_evidence FROM public.shift_task_voice_suggestions WHERE id = p_evidence_id AND organization_id = v_org;
  IF NOT FOUND OR NOT private.can_read_shift_task_voice_suggestion(v_evidence) THEN
    RAISE EXCEPTION 'VOICE_TASK_EVIDENCE_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;

  -- Retencja blokuje najpierw nagranie, a dopiero potem jego fragment.
  IF v_evidence.segment_id IS NOT NULL THEN
    PERFORM c.id FROM public.voice_captures c JOIN public.voice_segments s ON s.capture_id = c.id
      WHERE s.id = v_evidence.segment_id FOR SHARE OF c;
    PERFORM id FROM public.voice_segments WHERE id = v_evidence.segment_id FOR SHARE;
  ELSE
    PERFORM id FROM public.voice_draft_notes WHERE id = v_evidence.draft_id FOR SHARE;
  END IF;
  SELECT * INTO v_task FROM public.shift_tasks WHERE id = v_evidence.task_id AND organization_id = v_org FOR NO KEY UPDATE;
  SELECT * INTO v_evidence FROM public.shift_task_voice_suggestions WHERE id = p_evidence_id AND organization_id = v_org FOR UPDATE;
  IF NOT FOUND OR NOT private.can_read_shift_task_voice_suggestion(v_evidence) THEN
    RAISE EXCEPTION 'VOICE_TASK_EVIDENCE_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;

  IF v_evidence.decision IS NOT NULL THEN
    IF v_evidence.decision = p_decision AND v_evidence.decided_by = auth.uid()
      AND (p_decision <> 'CANCELLED' OR v_task.cancel_reason = btrim(p_reason))
      AND (p_decision <> 'CARRIED' OR EXISTS (
        SELECT 1 FROM public.shift_tasks
        WHERE id = v_evidence.result_task_id AND shift_definition_id = p_target_definition_id AND shift_date = p_target_date
      )) THEN
      RETURN v_evidence.result_task_id;
    END IF;
    RAISE EXCEPTION 'VOICE_TASK_EVIDENCE_ALREADY_DECIDED' USING ERRCODE = '23514';
  END IF;

  IF v_task.id IS NULL OR v_task.status <> 'TODO' OR v_task.updated_at <> v_evidence.task_updated_at
    OR v_task.shift_definition_id <> v_evidence.shift_definition_id OR v_task.shift_date <> v_evidence.shift_date
    OR v_task.resident_id IS DISTINCT FROM v_evidence.resident_id
    OR EXISTS (SELECT 1 FROM public.shift_tasks WHERE carried_from_task_id = v_task.id) THEN
    RAISE EXCEPTION 'VOICE_TASK_EVIDENCE_STALE' USING ERRCODE = '23514';
  END IF;
  IF p_decision IS NULL OR NOT (
    p_decision = 'REJECTED' OR (p_decision = 'DONE' AND v_evidence.kind = 'COMPLETED')
    OR (p_decision IN ('CANCELLED','CARRIED') AND v_evidence.kind IN ('NOT_COMPLETED','REFUSED'))
  ) THEN
    RAISE EXCEPTION 'VOICE_TASK_DECISION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_decision <> 'REJECTED' AND EXISTS (
    SELECT 1 FROM public.shift_task_voice_suggestions s WHERE s.task_id = v_task.id
      AND s.kind <> v_evidence.kind AND (s.kind = 'COMPLETED' OR v_evidence.kind = 'COMPLETED')
      AND s.decision IS DISTINCT FROM 'REJECTED' AND s.task_updated_at = v_task.updated_at
      AND private.shift_task_voice_source_current(s)
  ) THEN
    RAISE EXCEPTION 'VOICE_TASK_EVIDENCE_CONFLICT' USING ERRCODE = '23514';
  END IF;

  v_decided_at := clock_timestamp();
  IF p_decision IN ('DONE', 'CANCELLED') THEN
    -- Until result_task_id is saved, the status trigger uses this locked decision as its provenance.
    UPDATE public.shift_task_voice_suggestions SET decision = p_decision, decided_by = auth.uid(),
      decided_at = v_decided_at WHERE id = p_evidence_id;
  END IF;
  v_result := v_task.id;
  IF p_decision <> 'REJECTED' THEN
    v_result := public.settle_shift_task(v_task.id, p_decision, p_reason, p_target_definition_id, p_target_date);
  END IF;
  UPDATE public.shift_task_voice_suggestions SET decision = p_decision, decided_by = auth.uid(),
    decided_at = v_decided_at, result_task_id = v_result WHERE id = p_evidence_id;
  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, created_at, payload)
  VALUES (v_org, v_task.resident_id, 'VOICE_SHIFT_TASK_DECIDED', auth.uid(), v_decided_at, jsonb_build_object(
    'task_id', v_task.id, 'evidence_id', p_evidence_id, 'result_task_id', v_result,
    'shift_definition_id', v_task.shift_definition_id, 'shift_date', v_task.shift_date,
    'source_id', v_evidence.source_id, 'source_kind', v_evidence.source_kind, 'fragment_index', v_evidence.fragment_index,
    'author_id', v_evidence.author_id, 'author_attribution', v_evidence.author_attribution,
    'recorded_at', v_evidence.recorded_at, 'received_at', v_evidence.received_at,
    'decided_at', v_decided_at, 'decision', p_decision
  ));
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.read_shift_handover_audit(p_shift uuid, p_date date, p_offset integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_shift public.shift_definitions := private.require_shift_handover_scope(p_shift, p_date);
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', id, 'action', action, 'actor', performed_by, 'at', created_at,
      'taskId', payload->'task_id', 'sourceTaskId', payload->'source_task_id', 'version', payload->'version',
      'settlementMethod', payload->'settlement_method', 'sourceId', payload->'source_id',
      'previousVersion', payload->'previous_version', 'from', payload->'from', 'to', payload->'to',
      'assigneeId', payload->'assignee_id', 'previousAssigneeId', payload->'previous_assignee_id'
    )) ORDER BY created_at DESC, id DESC), '[]'::jsonb)
    FROM (
      SELECT id, action, performed_by, created_at, payload FROM public.audit_logs
      WHERE organization_id = v_shift.organization_id AND (
        (action IN ('SHIFT_TASK_CREATED', 'SHIFT_TASK_STATUS_CHANGED', 'SHIFT_TASK_ASSIGNEE_CHANGED',
          'SHIFT_TASK_CARRIED', 'SHIFT_PLAN_APPROVED', 'SHIFT_PLAN_PRINTED', 'SHIFT_HANDOVER_APPROVED',
          'SHIFT_HANDOVER_AMENDMENT_APPROVED', 'SHIFT_HANDOVER_ACKNOWLEDGED', 'VOICE_SHIFT_TASK_DECIDED')
          AND payload->>'shift_definition_id' = p_shift::text AND payload->>'shift_date' = p_date::text)
        OR (action = 'SHIFT_TASK_CARRIED' AND payload->>'source_shift_definition_id' = p_shift::text
          AND payload->>'source_shift_date' = p_date::text))
      ORDER BY created_at DESC, id DESC OFFSET greatest(p_offset, 0) LIMIT 51
    ) events
  );
END;
$$;
