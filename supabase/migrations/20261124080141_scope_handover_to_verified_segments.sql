-- @REQ: NUR-SHIFT-CLOSURE
-- @REQ: VOICE-RESIDENT-ASSIGN
CREATE OR REPLACE FUNCTION private.shift_handover_voice(
  p_org uuid, p_shift uuid, p_date date, p_start timestamptz, p_end timestamptz
) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH segment_times AS (
    SELECT s.id, s.capture_id, s.assignment_status, s.projection_status, s.author_attribution,
      COALESCE(s.corrected_at, s.derived_start_at) AS started_at
    FROM public.voice_segments s JOIN public.voice_captures c ON c.id = s.capture_id AND c.organization_id = p_org
    WHERE s.organization_id = p_org AND s.assignment_status <> 'SPLIT'
      AND (c.clock_state <> 'UNKNOWN' OR s.corrected_at IS NOT NULL)
      AND COALESCE(s.corrected_at, s.derived_start_at) >= p_start
      AND COALESCE(s.corrected_at, s.derived_start_at) < p_end
    UNION ALL
    -- Older rows predate persistence of the derived start. Offsets are signed 32-bit milliseconds.
    SELECT s.id, s.capture_id, s.assignment_status, s.projection_status, s.author_attribution,
      private.voice_segment_effective_at(s, c)
    FROM public.voice_captures c JOIN public.voice_segments s ON s.capture_id = c.id AND s.organization_id = p_org
    WHERE c.organization_id = p_org AND c.clock_state <> 'UNKNOWN'
      AND c.recorded_at >= p_start - 2147483647 * interval '1 millisecond' AND c.recorded_at < p_end
      AND s.corrected_at IS NULL AND s.derived_start_at IS NULL AND s.parent_segment_id IS NULL
      AND s.assignment_status <> 'SPLIT'
  ), segments AS (
    SELECT s.* FROM segment_times s
    CROSS JOIN LATERAL private.voice_shift_at(p_org, s.started_at) target
    WHERE s.started_at >= p_start AND s.started_at < p_end
      AND target.shift_definition_id = p_shift AND target.shift_date = p_date
  ), web_events AS (
    SELECT e.id, e.capture_source, e.recorded_at, e.created_at AS received_at,
      e.draft_note_id, e.sanitized_text, e.resident_id, e.author_id
    FROM public.voice_sanitized_events e
    WHERE e.organization_id = p_org AND e.segment_id IS NULL AND e.capture_source <> 'DEVICE'
      AND e.recorded_at >= p_start AND e.recorded_at < p_end
      AND NOT EXISTS (SELECT 1 FROM private.app_voice_task_recordings a WHERE a.draft_id = e.draft_note_id)
    UNION ALL
    SELECT e.id, e.capture_source, a.recorded_at, a.received_at,
      e.draft_note_id, e.sanitized_text, e.resident_id, e.author_id
    FROM private.app_voice_task_recordings a
    JOIN public.voice_sanitized_events e ON e.draft_note_id = a.draft_id AND e.organization_id = p_org
    WHERE a.recorded_at >= p_start AND a.recorded_at < p_end AND e.segment_id IS NULL AND e.capture_source = 'APP'
  ), material AS (
    SELECT e.id, e.capture_source AS source, s.started_at AS recorded_at, c.received_at,
      s.id AS source_id, s.author_attribution AS attribution, e.sanitized_text, e.resident_id,
      'event' AS kind, c.id AS capture_id, e.author_id
    FROM segments s JOIN public.voice_sanitized_events e ON e.segment_id = s.id AND e.organization_id = p_org
    JOIN public.voice_captures c ON c.id = s.capture_id AND c.organization_id = p_org
    WHERE s.assignment_status IN ('RESIDENT', 'FACILITY') AND s.projection_status = 'READY'
    UNION ALL
    SELECT e.id, e.capture_source, e.recorded_at, e.received_at, COALESCE(e.draft_note_id, e.id),
      CASE WHEN e.capture_source = 'APP' THEN 'AUTHENTICATED_SESSION' ELSE 'UNKNOWN' END,
      e.sanitized_text, e.resident_id, 'event', NULL, e.author_id
    FROM web_events e CROSS JOIN LATERAL private.voice_shift_at(p_org, e.recorded_at) target
    WHERE target.shift_definition_id = p_shift AND target.shift_date = p_date
    UNION ALL
    SELECT s.id, c.source, s.started_at, c.received_at, s.id, s.author_attribution,
      array_to_string(p.behavioral_facts, E'\n'), p.resident_id, 'behavior', c.id, p.author_id
    FROM segments s JOIN public.voice_segment_proposals p ON p.segment_id = s.id AND p.organization_id = p_org
    JOIN public.voice_captures c ON c.id = s.capture_id AND c.organization_id = p_org
    WHERE s.assignment_status = 'RESIDENT' AND s.projection_status = 'READY' AND cardinality(p.behavioral_facts) > 0
  ), facts AS (
    SELECT * FROM material m WHERE NOT EXISTS (
      SELECT 1 FROM private.shift_handover_versions v CROSS JOIN LATERAL jsonb_array_elements(v.facts) f
      WHERE v.organization_id = p_org AND v.shift_definition_id = p_shift AND v.shift_date = p_date
        AND f->>'id' = m.id::text AND COALESCE(f->>'kind', 'event') = m.kind
    )
  ), capture_states AS (
    SELECT c.id, c.source, c.received_at, c.source_key,
      c.status = 'SEGMENTED' AND bool_and(s.assignment_status = 'UNASSIGNABLE'
        OR (s.assignment_status IN ('RESIDENT', 'FACILITY') AND s.projection_status = 'READY')) AS ready
    FROM segments s JOIN public.voice_captures c ON c.id = s.capture_id AND c.organization_id = p_org
    GROUP BY c.id
    UNION ALL
    -- Before segmentation a verified capture start locates the pending intake.
    -- A successfully processed file with no fragments is also a receipt for its start shift.
    SELECT c.id, c.source, c.received_at, c.source_key, c.status = 'SEGMENTED'
    FROM public.voice_captures c CROSS JOIN LATERAL private.voice_shift_at(p_org, c.recorded_at) target
    WHERE c.organization_id = p_org AND c.clock_state <> 'UNKNOWN'
      AND c.recorded_at >= p_start AND c.recorded_at < p_end
      AND target.shift_definition_id = p_shift AND target.shift_date = p_date
      AND NOT EXISTS (SELECT 1 FROM public.voice_segments s WHERE s.capture_id = c.id)
    UNION ALL
    SELECT a.draft_id, 'APP', a.received_at, d.client_uuid,
      d.client_uuid IS NOT NULL AND j.completed_at IS NOT NULL
    FROM private.app_voice_task_recordings a JOIN public.voice_draft_notes d ON d.id = a.draft_id
    JOIN public.residents r ON r.id = d.resident_id AND r.organization_id = p_org
    LEFT JOIN public.voice_app_report_jobs j ON j.draft_id = a.draft_id
    CROSS JOIN LATERAL private.voice_shift_at(p_org, a.recorded_at) target
    WHERE a.recorded_at >= p_start AND a.recorded_at < p_end
      AND target.shift_definition_id = p_shift AND target.shift_date = p_date
  ), exceptions AS (
    SELECT 'NO_AUTHOR' = ANY(q.reasons) AS unknown_author
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
