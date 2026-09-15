-- Migration: 20260915180000_wearable_batch_ingest_buffer.sql
-- Description: Skalowalny bufor wsadowy i deduplikacja danych telemetrycznych opasek (INT-INGEST-PRECONDITIONS, INT-NORMALIZATION)

CREATE OR REPLACE FUNCTION public.process_ingest_batch(
  p_org_id uuid,
  p_res_id uuid,
  p_provider text,
  p_payloads jsonb -- tablica obiektów lub string JSON
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
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
  -- 1. Autoryzacja organizacji
  IF p_org_id <> public.get_jwt_organization_id() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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
