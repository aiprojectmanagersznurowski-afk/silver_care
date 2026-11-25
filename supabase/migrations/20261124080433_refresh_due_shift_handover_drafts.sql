-- @REQ: NUR-SHIFT-CLOSURE
CREATE TABLE private.shift_handover_draft_snapshots (
  organization_id uuid NOT NULL,
  shift_definition_id uuid NOT NULL,
  shift_date date NOT NULL,
  revision text NOT NULL,
  refreshed_at timestamptz NOT NULL,
  material jsonb,
  PRIMARY KEY (organization_id, shift_definition_id, shift_date),
  FOREIGN KEY (shift_definition_id, organization_id)
    REFERENCES public.shift_definitions (id, organization_id) ON DELETE CASCADE
);
ALTER TABLE private.shift_handover_draft_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.shift_handover_draft_snapshots FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.refresh_due_shift_handovers(
  p_buffer_minutes integer, p_now timestamptz DEFAULT now(), p_org uuid DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_today date := (p_now AT TIME ZONE 'Europe/Warsaw')::date;
  v_occurrence record;
  v_shift public.shift_definitions;
  v_draft jsonb;
  v_material jsonb;
  v_changed integer := 0;
BEGIN
  PERFORM private.require_report_service();
  IF p_buffer_minutes IS NULL OR p_buffer_minutes NOT BETWEEN 0 AND 1440 OR p_now IS NULL OR NOT isfinite(p_now) THEN
    RAISE EXCEPTION 'SHIFT_HANDOVER_REFRESH_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('refresh-due-shift-handovers', 0)) THEN RETURN 0; END IF;

  FOR v_occurrence IN
    SELECT d AS definition, t.local_day::date AS shift_date
    FROM public.shift_definitions d
    LEFT JOIN LATERAL (
      SELECT s.shift_date FROM private.shift_handover_draft_snapshots s
      WHERE s.organization_id = d.organization_id AND s.shift_definition_id = d.id
      ORDER BY s.shift_date DESC LIMIT 1
    ) cursor ON true
    CROSS JOIN LATERAL generate_series(
      LEAST(COALESCE(cursor.shift_date, v_today - 1), v_today - 1)::timestamp,
      LEAST(COALESCE(cursor.shift_date, v_today - 1) + 7, v_today)::timestamp, interval '1 day'
    ) t(local_day)
    WHERE d.is_active AND (p_org IS NULL OR d.organization_id = p_org)
      AND public.has_org_feature(d.organization_id, 'module_shift_tasks')
      AND ((t.local_day::date + d.crosses_midnight::integer + d.end_time) AT TIME ZONE 'Europe/Warsaw')
        + make_interval(mins => p_buffer_minutes) <= p_now
    ORDER BY t.local_day, d.organization_id, d.id
  LOOP
    v_shift := v_occurrence.definition;
    v_draft := private.shift_handover_draft(v_shift, v_occurrence.shift_date);
    v_material := NULL;
    IF (v_draft->>'canApprove')::boolean THEN
      -- Keep the prepared draft's references and state. Source text stays in its retention-controlled resource.
      v_material := jsonb_set(v_draft, '{facts}',
        COALESCE((SELECT jsonb_agg(f - 'text' ORDER BY ord)
          FROM jsonb_array_elements(v_draft->'facts') WITH ORDINALITY AS fact(f, ord)), '[]'::jsonb));
    END IF;
    INSERT INTO private.shift_handover_draft_snapshots AS saved
      (organization_id, shift_definition_id, shift_date, revision, refreshed_at, material)
    VALUES (v_shift.organization_id, v_shift.id, v_occurrence.shift_date,
      private.shift_handover_revision(v_draft), p_now, v_material)
    ON CONFLICT (organization_id, shift_definition_id, shift_date) DO UPDATE
    SET revision = EXCLUDED.revision, refreshed_at = EXCLUDED.refreshed_at, material = EXCLUDED.material
    WHERE saved.revision IS DISTINCT FROM EXCLUDED.revision AND saved.refreshed_at <= EXCLUDED.refreshed_at;
    IF FOUND THEN v_changed := v_changed + 1; END IF;
  END LOOP;
  RETURN v_changed;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_due_shift_handovers(integer,timestamptz,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_due_shift_handovers(integer,timestamptz,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.preview_shift_handover(p_shift uuid, p_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' SET log_parameter_max_length_on_error = 0 AS $$
DECLARE
  v_shift public.shift_definitions := private.require_shift_handover_scope(p_shift, p_date);
  v_draft jsonb := private.shift_handover_draft(v_shift, p_date);
  v_revision text := private.shift_handover_revision(v_draft);
  v_prepared_at timestamptz;
BEGIN
  -- A late change is visible immediately. A scheduled snapshot can never hide it or authorize it.
  SELECT s.refreshed_at INTO v_prepared_at FROM private.shift_handover_draft_snapshots s
  WHERE s.organization_id = v_shift.organization_id AND s.shift_definition_id = p_shift AND s.shift_date = p_date
    AND s.revision = v_revision AND s.material IS NOT NULL;
  RETURN v_draft || jsonb_build_object('revision', v_revision, 'preparedAt', v_prepared_at,
    'versions', private.shift_handover_versions_json(v_shift.organization_id, p_shift, p_date));
END;
$$;
NOTIFY pgrst, 'reload schema';
