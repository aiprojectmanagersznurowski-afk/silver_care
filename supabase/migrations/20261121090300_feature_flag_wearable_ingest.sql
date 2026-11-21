-- @REQ: SUP-FEATURE-FLAGS
CREATE POLICY feature_polar_tokens ON public.polar_oauth_tokens AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_org_feature(organization_id, 'module_wearables_iot'));

CREATE POLICY feature_wearable_ingest ON public.physiological_data_ingest AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_org_feature(organization_id, 'module_wearables_iot'))
  WITH CHECK (
    public.has_org_feature(organization_id, 'module_wearables_iot')
    AND EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = resident_id AND r.organization_id = physiological_data_ingest.organization_id
    )
  );

CREATE FUNCTION private.assert_wearable_ingest_enabled(p_org_id uuid, p_res_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_org_feature(p_org_id, 'module_wearables_iot') OR NOT (
    current_setting('role') IN ('service_role', 'postgres')
    OR (current_setting('role') = 'none' AND session_user = 'postgres')
    OR (public.get_jwt_organization_id() IS NOT DISTINCT FROM p_org_id
        AND COALESCE(auth.jwt()->'app_metadata'->>'role', '') IN ('org_admin', 'super_admin'))
  ) OR NOT EXISTS (
    SELECT 1 FROM public.residents r WHERE r.id = p_res_id AND r.organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Wearable ingest unavailable' USING ERRCODE = '42501';
  END IF;
END
$$;
REVOKE ALL ON FUNCTION private.assert_wearable_ingest_enabled(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.process_ingest_payload(
  p_org_id uuid,
  p_res_id uuid,
  p_metric text,
  p_value numeric,
  p_dedup_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.assert_wearable_ingest_enabled(p_org_id, p_res_id);

  -- 1. Deduplication check
  IF EXISTS (SELECT 1 FROM public.physiological_data_ingest WHERE deduplication_id = p_dedup_id) THEN
    -- Silently ignore duplicate
    RETURN;
  END IF;

  -- 2. Resident archived check
  IF EXISTS (SELECT 1 FROM public.residents WHERE id = p_res_id AND archived_at IS NOT NULL) THEN
    INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
    VALUES (p_org_id, p_res_id, 'INGEST_REJECTED', '{"reason": "Resident archived"}'::jsonb);
    RETURN;
  END IF;

  -- 3. Consent check
  IF NOT EXISTS (
    SELECT 1 FROM public.consent_ledger
    WHERE resident_id = p_res_id
    AND purpose = 'wellness_data_ingest'
    AND revoked_at IS NULL
  ) THEN
    INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
    VALUES (p_org_id, p_res_id, 'INGEST_REJECTED', '{"reason": "No active consent"}'::jsonb);
    RETURN;
  END IF;

  -- All preconditions met, insert data
  INSERT INTO public.physiological_data_ingest (organization_id, resident_id, metric, value, deduplication_id)
  VALUES (p_org_id, p_res_id, p_metric, p_value, p_dedup_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_and_ingest(
  p_org_id uuid,
  p_res_id uuid,
  p_provider text,
  p_metric text,
  p_raw_value text,
  p_dedup_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_numeric_value numeric;
BEGIN
  PERFORM private.assert_wearable_ingest_enabled(p_org_id, p_res_id);

  -- Normalization logic
  IF p_raw_value LIKE 'PT%' THEN
    -- It's an ISO8601 duration, convert to minutes
    v_numeric_value := extract(epoch from p_raw_value::interval) / 60;
  ELSE
    -- Cast to numeric normally
    v_numeric_value := p_raw_value::numeric;
  END IF;

  -- Process the ingest
  PERFORM public.process_ingest_payload(p_org_id, p_res_id, p_metric, v_numeric_value, p_dedup_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_ingest_batch(
  p_org_id uuid,
  p_res_id uuid,
  p_provider text,
  p_payloads jsonb -- tablica obiektów lub string JSON
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted_count int := 0;
  v_duplicate_count int := 0;
  v_item jsonb;
  v_raw_val text;
  v_metric text;
  v_dedup_id text;
  v_numeric_value numeric;
  v_json_array jsonb;
BEGIN
  PERFORM private.assert_wearable_ingest_enabled(p_org_id, p_res_id);

  -- 2. Sprawdzenie statusu pensjonariusza (jeden lookup dla całej paczki)
  IF EXISTS (SELECT 1 FROM public.residents WHERE id = p_res_id AND archived_at IS NOT NULL) THEN
    INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
    VALUES (p_org_id, p_res_id, 'INGEST_REJECTED', '{"reason": "Resident archived"}'::jsonb);
    RETURN jsonb_build_object('success', false, 'reason', 'Resident archived', 'inserted', 0);
  END IF;

  -- 3. Sprawdzenie zgody na ingest (jeden lookup dla całej paczki pensjonariusza)
  IF NOT EXISTS (
    SELECT 1 FROM public.consent_ledger
    WHERE resident_id = p_res_id
    AND purpose = 'wellness_data_ingest'
    AND revoked_at IS NULL
  ) THEN
    INSERT INTO public.audit_logs (organization_id, resident_id, action, payload)
    VALUES (p_org_id, p_res_id, 'INGEST_REJECTED', '{"reason": "No active consent"}'::jsonb);
    RETURN jsonb_build_object('success', false, 'reason', 'No active consent', 'inserted', 0);
  END IF;

  -- Ustalenie czy p_payloads to string JSON czy już sparsowana tablica jsonb
  IF jsonb_typeof(p_payloads) = 'string' THEN
    v_json_array := (p_payloads #>> '{}')::jsonb;
  ELSE
    v_json_array := p_payloads;
  END IF;

  -- 4. Wstawianie wsadowe z normalizacją i deduplikacją (ON CONFLICT DO NOTHING)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_json_array)
  LOOP
    v_metric := v_item->>'metric';
    v_raw_val := v_item->>'raw_value';
    v_dedup_id := v_item->>'dedup_id';

    IF v_metric IS NOT NULL AND v_raw_val IS NOT NULL THEN
      -- Normalizacja (np. format ISO8601 PT30M na minuty)
      IF v_raw_val LIKE 'PT%' THEN
        v_numeric_value := extract(epoch from v_raw_val::interval) / 60;
      ELSE
        v_numeric_value := v_raw_val::numeric;
      END IF;

      INSERT INTO public.physiological_data_ingest (
        organization_id,
        resident_id,
        metric,
        value,
        deduplication_id
      )
      VALUES (
        p_org_id,
        p_res_id,
        v_metric,
        v_numeric_value,
        v_dedup_id
      )
      ON CONFLICT (deduplication_id) DO NOTHING;

      IF FOUND THEN
        v_inserted_count := v_inserted_count + 1;
      ELSE
        v_duplicate_count := v_duplicate_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted_count,
    'duplicates_ignored', v_duplicate_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.process_ingest_payload(uuid, uuid, text, numeric, text),
  public.normalize_and_ingest(uuid, uuid, text, text, text, text),
  public.process_ingest_batch(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.process_ingest_payload(uuid, uuid, text, numeric, text),
  public.normalize_and_ingest(uuid, uuid, text, text, text, text),
  public.process_ingest_batch(uuid, uuid, text, jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE VIEW public.resident_sync_status WITH (security_invoker = true) AS
SELECT
  r.id as resident_id,
  r.organization_id,
  EXTRACT(EPOCH FROM (now() - MAX(p.recorded_at))) as seconds_since_last_ping,
  CASE
    WHEN MAX(p.recorded_at) IS NULL THEN 'OFFLINE'
    WHEN now() - MAX(p.recorded_at) > interval '24 hours' THEN 'OFFLINE'
    WHEN now() - MAX(p.recorded_at) > interval '12 hours' THEN 'STALE'
    ELSE 'ACTIVE'
  END as sync_state
FROM public.residents r
LEFT JOIN public.physiological_data_ingest p ON p.resident_id = r.id
WHERE r.archived_at IS NULL
  AND public.has_org_feature(r.organization_id, 'module_wearables_iot')
GROUP BY r.id, r.organization_id;
