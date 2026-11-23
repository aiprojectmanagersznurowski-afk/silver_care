-- @REQ: NUR-TASKS-VOICE-COMPLETION
-- @REQ: SEC-MFA-STAFF
-- @REQ: SEC-AUDIT-APPEND-ONLY
-- @REQ: VOICE-RETENTION

CREATE TABLE public.shift_task_voice_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shift_definition_id uuid NOT NULL,
  shift_date date NOT NULL,
  task_id uuid NOT NULL REFERENCES public.shift_tasks(id) ON DELETE CASCADE,
  resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
  segment_id uuid,
  draft_id uuid REFERENCES public.voice_draft_notes(id) ON DELETE CASCADE,
  source_id uuid NOT NULL,
  fragment_index integer NOT NULL CHECK (fragment_index >= 0),
  source_kind text NOT NULL CHECK (source_kind IN ('APP', 'APP_GENERAL', 'DEVICE')),
  author_id uuid NOT NULL,
  author_attribution text NOT NULL,
  recorded_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  draft_updated_at timestamptz,
  task_updated_at timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('COMPLETED', 'NOT_COMPLETED', 'REFUSED')),
  quote text NOT NULL CHECK (length(btrim(quote)) BETWEEN 1 AND 300),
  decision text CHECK (decision IN ('DONE', 'CANCELLED', 'CARRIED', 'REJECTED')),
  decided_by uuid,
  decided_at timestamptz,
  result_task_id uuid,
  UNIQUE (task_id, source_kind, source_id, fragment_index),
  FOREIGN KEY (segment_id, organization_id) REFERENCES public.voice_segments(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (shift_definition_id, organization_id) REFERENCES public.shift_definitions(id, organization_id),
  CHECK (CASE WHEN source_kind = 'APP' THEN
      draft_id IS NOT NULL AND source_id = draft_id AND segment_id IS NULL
      AND draft_updated_at IS NOT NULL AND resident_id IS NOT NULL
    ELSE segment_id IS NOT NULL AND source_id = segment_id AND draft_id IS NULL AND draft_updated_at IS NULL END),
  CHECK (CASE WHEN source_kind = 'DEVICE' THEN author_attribution IN ('DECLARED_SESSION', 'MANUAL_SEGMENT_CORRECTION')
    ELSE author_attribution = 'AUTHENTICATED_SESSION' END),
  CHECK ((decision IS NULL) = (decided_at IS NULL) AND (decided_at IS NULL) = (decided_by IS NULL))
);
CREATE INDEX shift_task_voice_suggestions_shift ON public.shift_task_voice_suggestions
  (organization_id, shift_definition_id, shift_date, task_id);
CREATE INDEX shift_task_voice_suggestions_segment ON public.shift_task_voice_suggestions (segment_id) WHERE segment_id IS NOT NULL;
CREATE INDEX shift_task_voice_suggestions_draft ON public.shift_task_voice_suggestions (draft_id) WHERE draft_id IS NOT NULL;
CREATE INDEX shift_task_voice_suggestions_resident ON public.shift_task_voice_suggestions (resident_id) WHERE resident_id IS NOT NULL;

ALTER TABLE public.shift_task_voice_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shift_task_voice_suggestions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.shift_task_voice_suggestions TO authenticated;

CREATE FUNCTION private.shift_task_voice_source_current(p_evidence public.shift_task_voice_suggestions)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_evidence.source_kind = 'APP' THEN EXISTS (
    SELECT 1 FROM public.voice_draft_notes d JOIN public.residents r ON r.id = d.resident_id
    WHERE d.id = p_evidence.draft_id AND d.status = 'PROCESSED'
      AND d.resident_id = p_evidence.resident_id AND d.nurse_id = p_evidence.author_id
      AND d.updated_at = p_evidence.draft_updated_at AND d.created_at = p_evidence.received_at
      -- Ta sama granica co w cleanup_voice_drafts (VOICE-RETENTION).
      AND d.created_at >= now() - interval '30 days'
      AND r.organization_id = p_evidence.organization_id AND r.archived_at IS NULL
  ) ELSE EXISTS (
    SELECT 1 FROM public.voice_segments s JOIN public.voice_captures c ON c.id = s.capture_id
    LEFT JOIN public.voice_retention_settings r ON r.organization_id = c.organization_id
    WHERE s.id = p_evidence.segment_id AND s.organization_id = p_evidence.organization_id
      AND s.resident_id IS NOT DISTINCT FROM p_evidence.resident_id AND s.author_id = p_evidence.author_id
      AND s.author_attribution = p_evidence.author_attribution AND s.assignment_status IN ('RESIDENT','FACILITY')
      AND (c.source = 'DEVICE' OR c.author_id = s.author_id)
      AND (s.resident_id IS NULL OR EXISTS (SELECT 1 FROM public.residents person
        WHERE person.id = s.resident_id AND person.organization_id = s.organization_id AND person.archived_at IS NULL))
      AND c.status = 'SEGMENTED' AND c.source = p_evidence.source_kind AND c.clock_state <> 'UNKNOWN'
      AND c.recorded_at = p_evidence.recorded_at AND c.received_at = p_evidence.received_at
      AND c.received_at >= now() - make_interval(days => COALESCE(r.retention_days, 30))
  ) END;
$$;

CREATE FUNCTION private.can_read_shift_task_voice_suggestion(p_evidence public.shift_task_voice_suggestions)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text := auth.jwt()->'app_metadata'->>'role';
BEGIN
  IF auth.uid() IS NULL OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'
    OR NOT COALESCE(public.check_mfa_requirement(), false)
    OR p_evidence.organization_id IS DISTINCT FROM public.get_jwt_organization_id()
    OR (v_role = 'org_admin' OR (v_role = 'nurse'
        AND public.is_shift_lead(p_evidence.shift_definition_id, p_evidence.shift_date))) IS NOT TRUE
    OR NOT public.has_org_feature(p_evidence.organization_id, 'module_voice_and_reports')
    OR NOT public.has_org_feature(p_evidence.organization_id, 'module_shift_tasks') THEN
    RETURN false;
  END IF;
  RETURN private.shift_task_voice_source_current(p_evidence);
END $$;

REVOKE ALL ON FUNCTION private.shift_task_voice_source_current(public.shift_task_voice_suggestions),
  private.can_read_shift_task_voice_suggestion(public.shift_task_voice_suggestions) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_shift_task_voice_suggestion(public.shift_task_voice_suggestions) TO authenticated;
CREATE POLICY shift_task_voice_suggestions_read ON public.shift_task_voice_suggestions
  FOR SELECT TO authenticated USING (private.can_read_shift_task_voice_suggestion(shift_task_voice_suggestions));

CREATE FUNCTION public.decide_shift_task_voice_suggestion(
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

  v_result := v_task.id;
  IF p_decision <> 'REJECTED' THEN
    v_result := public.settle_shift_task(v_task.id, p_decision, p_reason, p_target_definition_id, p_target_date);
  END IF;
  v_decided_at := clock_timestamp();
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

REVOKE ALL ON FUNCTION public.decide_shift_task_voice_suggestion(uuid,text,text,uuid,date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decide_shift_task_voice_suggestion(uuid,text,text,uuid,date) TO authenticated;
NOTIFY pgrst, 'reload schema';
