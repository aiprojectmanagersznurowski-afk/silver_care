-- @REQ: NUR-SHIFT-CLOSURE
-- Use the upload identifier from the independently declared manifest.
CREATE INDEX voice_segments_handover_effective_start
ON public.voice_segments (organization_id, (COALESCE(corrected_at, derived_start_at)), capture_id);

CREATE OR REPLACE FUNCTION private.shift_handover_voice(
  p_org uuid, p_shift uuid, p_date date, p_start timestamptz, p_end timestamptz
) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH material AS (
    SELECT e.id, e.capture_source AS source, e.recorded_at,
      COALESCE(c.received_at, app.received_at, e.created_at) AS received_at,
      COALESCE(e.segment_id, e.draft_note_id, e.id) AS source_id,
      COALESCE(s.author_attribution, CASE WHEN e.capture_source = 'APP' THEN 'AUTHENTICATED_SESSION' END, 'UNKNOWN') AS attribution,
      e.sanitized_text, e.resident_id, 'event' AS kind, c.id AS capture_id, e.author_id
    FROM public.voice_sanitized_events e
    LEFT JOIN public.voice_segments s ON s.id = e.segment_id AND s.organization_id = e.organization_id
    LEFT JOIN public.voice_captures c ON c.id = s.capture_id AND c.organization_id = e.organization_id
    LEFT JOIN private.app_voice_task_recordings app ON app.draft_id = e.draft_note_id
    WHERE e.organization_id = p_org AND e.recorded_at >= p_start AND e.recorded_at < p_end
    UNION ALL
    SELECT p.segment_id, c.source, p.recorded_at, c.received_at, p.segment_id, s.author_attribution,
      array_to_string(p.behavioral_facts, E'\n'), p.resident_id, 'behavior', c.id, p.author_id
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
  ), shift_capture_ids AS (
    SELECT c.id FROM public.voice_captures c
    WHERE c.organization_id = p_org AND c.recorded_at >= p_start AND c.recorded_at < p_end
    UNION
    SELECT s.capture_id FROM public.voice_segments s
    WHERE s.organization_id = p_org AND COALESCE(s.corrected_at, s.derived_start_at) >= p_start
      AND COALESCE(s.corrected_at, s.derived_start_at) < p_end
  ), capture_states AS (
    SELECT c.id, c.source, c.received_at, c.source_key,
      c.status = 'SEGMENTED' AND c.clock_state <> 'UNKNOWN' AND NOT EXISTS (
        SELECT 1 FROM public.voice_segments s WHERE s.capture_id = c.id AND s.organization_id = p_org
          AND (s.assignment_status = 'PENDING' OR
            (s.assignment_status IN ('RESIDENT','FACILITY') AND s.projection_status <> 'READY'))
      ) AS ready
    FROM shift_capture_ids scoped JOIN public.voice_captures c ON c.id = scoped.id AND c.organization_id = p_org
    UNION ALL
    SELECT a.draft_id, 'APP', a.received_at, d.client_uuid,
      d.client_uuid IS NOT NULL AND j.completed_at IS NOT NULL
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
      'sourceId', source_id, 'attribution', attribution, 'text', sanitized_text, 'residentId', resident_id, 'kind', kind,
      'captureId', capture_id, 'authorId', author_id
    ) ORDER BY recorded_at, id) FROM facts), '[]'::jsonb),
    'receipts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'source', source, 'receivedAt', received_at, 'sourceKey', source_key
    ) ORDER BY received_at, id) FROM capture_states WHERE ready), '[]'::jsonb),
    'pendingSources', (SELECT count(*) FROM capture_states WHERE NOT ready),
    'exceptions', (SELECT count(*) FROM exceptions),
    'unknownAuthors', (SELECT count(*) FROM exceptions WHERE unknown_author)
  )
$$;
