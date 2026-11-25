-- @REQ: REPORT-APPROVAL
-- @REQ: VOICE-DOCK-REPORTS
-- @REQ: VOICE-DRAFT-ISOLATION

ALTER TABLE public.voice_segment_proposals ADD COLUMN family_decision text
  CHECK (family_decision IN ('ACCEPTED','REJECTED'));

CREATE TABLE public.family_voice_report_provenance (
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  report_day date NOT NULL,
  report_id uuid NOT NULL UNIQUE REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  last_generated_fingerprint text NOT NULL,
  source_segment_ids uuid[] NOT NULL,
  PRIMARY KEY (resident_id, report_day)
);
ALTER TABLE public.family_voice_report_provenance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_voice_report_provenance FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.family_voice_report_provenance TO service_role;

CREATE FUNCTION public.review_voice_family_facts(p_segment_id uuid, p_accept boolean)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_org uuid := public.get_jwt_organization_id(); v_prop public.voice_segment_proposals;
  v_day date; v_start timestamptz; v_end timestamptz; v_sources uuid[]; v_text text; v_report_id uuid;
  v_status text; v_fingerprint text; v_generated_fingerprint text;
  v_decision text := CASE WHEN p_accept THEN 'ACCEPTED' ELSE 'REJECTED' END;
BEGIN
  PERFORM private.require_report_staff(v_org, ARRAY['nurse','org_admin'], true);
  SELECT * INTO v_prop FROM public.voice_segment_proposals p
    WHERE p.segment_id = p_segment_id AND p.organization_id = v_org
      AND p.resident_id IS NOT NULL AND cardinality(p.behavioral_facts) > 0
      AND (auth.jwt()->'app_metadata'->>'role' = 'org_admin' OR p.author_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_FAMILY_FACT_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF p_accept IS NULL THEN RAISE EXCEPTION 'VOICE_REVIEW_DECISION_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF p_accept AND v_prop.time_state = 'UNKNOWN' THEN
    RAISE EXCEPTION 'VOICE_FAMILY_REPORT_TIME_REQUIRED' USING ERRCODE = '22023';
  END IF;

  v_day := (v_prop.recorded_at AT TIME ZONE 'Europe/Warsaw')::date;
  v_start := v_day::timestamp AT TIME ZONE 'Europe/Warsaw';
  v_end := (v_day + 1)::timestamp AT TIME ZONE 'Europe/Warsaw';
  PERFORM id FROM public.residents WHERE id = v_prop.resident_id AND organization_id = v_org
    AND archived_at IS NULL FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_FAMILY_RESIDENT_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(concat('voice-family/', v_prop.resident_id, '/', v_day), 0));

  SELECT p.family_decision INTO v_prop.family_decision FROM public.voice_segment_proposals p
    WHERE p.segment_id = p_segment_id FOR UPDATE;
  SELECT report_id, last_generated_fingerprint INTO v_report_id, v_generated_fingerprint
    FROM public.family_voice_report_provenance WHERE resident_id = v_prop.resident_id AND report_day = v_day;
  IF v_prop.family_decision IS NOT NULL THEN
    IF v_prop.family_decision <> v_decision THEN
      RAISE EXCEPTION 'VOICE_FAMILY_FACT_ALREADY_REVIEWED' USING ERRCODE = '23514';
    END IF;
    RETURN CASE WHEN p_accept THEN v_report_id ELSE NULL END;
  END IF;

  UPDATE public.voice_segment_proposals SET family_decision = v_decision,
    reviewed_by = auth.uid(), reviewed_at = now() WHERE segment_id = p_segment_id;
  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
    VALUES (v_org, v_prop.resident_id, 'VOICE_FAMILY_FACT_REVIEWED', auth.uid(),
      jsonb_build_object('segment_id', p_segment_id, 'decision', v_decision));
  IF NOT p_accept THEN RETURN NULL; END IF;

  SELECT array_agg(p.segment_id ORDER BY p.recorded_at, p.segment_id) INTO v_sources
    FROM public.voice_segment_proposals p
    WHERE p.organization_id = v_org AND p.resident_id = v_prop.resident_id
      AND p.time_state <> 'UNKNOWN' AND p.recorded_at >= v_start AND p.recorded_at < v_end
      AND p.family_decision = 'ACCEPTED';
  SELECT string_agg(fact, E'\n' ORDER BY first_source, first_position) INTO v_text FROM (
    SELECT fact, min(100000 * p.ord + f.ord) AS first_source, min(f.ord) AS first_position
    FROM unnest(v_sources) WITH ORDINALITY p(id, ord)
    JOIN public.voice_segment_proposals s ON s.segment_id = p.id
    CROSS JOIN LATERAL unnest(s.behavioral_facts) WITH ORDINALITY f(fact, ord) GROUP BY fact
  ) dedup;
  PERFORM private.report_required(v_text);
  -- AI_DISCLOSURE_LABEL (presentation.contract.mjs). Treść widoczna po publikacji przez personel.
  v_text := v_text || E'\n\nPodsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki';

  IF v_report_id IS NULL THEN
    INSERT INTO public.daily_reports (resident_id, author_id, content, status, ai_generated, ai_model, ai_prompt_version)
    VALUES (v_prop.resident_id, v_prop.author_id, jsonb_build_object('text', v_text), 'DRAFT', true,
      'rule-based-voice-family-v1', 'rule-based-voice-family-v1')
    RETURNING id INTO v_report_id;
  ELSE
    SELECT status, md5(content->>'text') INTO v_status, v_fingerprint FROM public.daily_reports
      WHERE id = v_report_id FOR UPDATE;
    IF v_status IS DISTINCT FROM 'DRAFT' OR v_fingerprint IS DISTINCT FROM v_generated_fingerprint THEN
      RAISE EXCEPTION 'VOICE_FAMILY_DRAFT_ALREADY_REVIEWED' USING ERRCODE = '23514';
    END IF;
    UPDATE public.daily_reports SET content = jsonb_build_object('text', v_text),
      updated_at = now(), ai_generated_at = now() WHERE id = v_report_id;
  END IF;
  INSERT INTO public.family_voice_report_provenance
    (resident_id, report_day, report_id, last_generated_fingerprint, source_segment_ids)
    VALUES (v_prop.resident_id, v_day, v_report_id, md5(v_text), v_sources)
  ON CONFLICT (resident_id, report_day) DO UPDATE SET last_generated_fingerprint = EXCLUDED.last_generated_fingerprint,
    source_segment_ids = EXCLUDED.source_segment_ids;
  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
    VALUES (v_org, v_prop.resident_id, 'VOICE_FAMILY_DRAFT_GENERATED', auth.uid(),
      jsonb_build_object('report_id', v_report_id, 'segment_ids', v_sources, 'report_day', v_day));
  RETURN v_report_id;
END $$;

REVOKE ALL ON FUNCTION public.review_voice_family_facts(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_voice_family_facts(uuid,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
