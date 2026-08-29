-- Migration: 20260829130000_normalization_and_staleness.sql

-- 1. INT-NORMALIZATION: function to normalize raw data
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
AS $$
DECLARE
  v_numeric_value numeric;
BEGIN
  -- Verify caller is authorized
  IF p_org_id <> public.get_jwt_organization_id() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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

-- 2. INT-SYNC-STALENESS: view for sync staleness
CREATE OR REPLACE VIEW public.resident_sync_status AS
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
GROUP BY r.id, r.organization_id;

-- Secure the view with RLS
ALTER VIEW public.resident_sync_status SET (security_invoker = true);
