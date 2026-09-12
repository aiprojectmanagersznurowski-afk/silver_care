-- Migration: 20260912221500_resident_zsn.sql
-- Add ZSN (Znaczny stopień niepełnosprawności) flag and update reporting functions

-- 1. Add is_zsn column to residents
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS is_zsn boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.residents.is_zsn IS 'Znaczny stopień niepełnosprawności (ZSN)';

-- 2. Drop existing functions to allow changing return types
DROP FUNCTION IF EXISTS public.fn_monthly_summary(uuid, int, int) CASCADE;
DROP FUNCTION IF EXISTS public.fn_daily_report(uuid, int, int) CASCADE;
DROP FUNCTION IF EXISTS public.fn_occupancy_kpi(uuid) CASCADE;

-- 3. Recreate fn_daily_report with zsn_count
CREATE OR REPLACE FUNCTION public.fn_daily_report(
  p_org_id uuid,
  p_year int,
  p_month int
)
RETURNS TABLE (
  report_date date,
  total_residents bigint,
  zsn_count bigint,
  deaths bigint,
  contracts_signed bigint,
  contracts_ended bigint,
  delta_change bigint,
  available_beds bigint,
  occupied_beds bigint
)
LANGUAGE sql STABLE
AS $$
  WITH date_series AS (
    SELECT generate_series(
      make_date(p_year, p_month, 1),
      (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date,
      '1 day'::interval
    )::date AS d
  ),
  daily_events AS (
    SELECT
      re.event_date,
      COUNT(*) FILTER (WHERE re.event_type = 'death') AS deaths,
      COUNT(*) FILTER (WHERE re.event_type = 'contract_signed') AS contracts_signed,
      COUNT(*) FILTER (WHERE re.event_type = 'contract_ended' AND COALESCE(re.event_reason, '') <> 'death') AS contracts_ended
    FROM public.resident_events re
    WHERE re.organization_id = p_org_id
      AND re.event_date >= make_date(p_year, p_month, 1)
      AND re.event_date < make_date(p_year, p_month, 1) + interval '1 month'
    GROUP BY re.event_date
  ),
  capacity AS (
    SELECT COUNT(*)::bigint AS total_beds
    FROM public.beds b
    JOIN public.rooms r ON r.id = b.room_id
    WHERE r.organization_id = p_org_id
      AND b.is_active = true
      AND r.is_active = true
  ),
  daily_residents AS (
    SELECT
      ds.d,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE res.is_zsn = true)::bigint AS zsn
    FROM date_series ds
    LEFT JOIN public.residents res ON
      res.organization_id = p_org_id
      AND res.admission_date IS NOT NULL
      AND res.admission_date <= ds.d
      AND (res.contract_end_date IS NULL OR res.contract_end_date > ds.d)
      AND (res.death_date IS NULL OR res.death_date > ds.d)
      AND (res.archived_at IS NULL OR res.archived_at::date > ds.d)
    GROUP BY ds.d
  ),
  daily_occupied AS (
    SELECT
      ds.d,
      COUNT(*)::bigint AS occupied
    FROM date_series ds
    LEFT JOIN public.bed_assignments ba ON
      ba.assigned_at::date <= ds.d
      AND (ba.unassigned_at IS NULL OR ba.unassigned_at::date > ds.d)
    LEFT JOIN public.residents res ON res.id = ba.resident_id
      AND res.organization_id = p_org_id
    WHERE res.id IS NOT NULL
    GROUP BY ds.d
  )
  SELECT
    ds.d AS report_date,
    COALESCE(dr.total, 0) AS total_residents,
    COALESCE(dr.zsn, 0) AS zsn_count,
    COALESCE(de.deaths, 0) AS deaths,
    COALESCE(de.contracts_signed, 0) AS contracts_signed,
    COALESCE(de.contracts_ended, 0) AS contracts_ended,
    COALESCE(de.contracts_signed, 0) - COALESCE(de.contracts_ended, 0) - COALESCE(de.deaths, 0) AS delta_change,
    COALESCE(c.total_beds, 0) AS available_beds,
    COALESCE(occ.occupied, 0) AS occupied_beds
  FROM date_series ds
  LEFT JOIN daily_residents dr ON dr.d = ds.d
  LEFT JOIN daily_events de ON de.event_date = ds.d
  LEFT JOIN daily_occupied occ ON occ.d = ds.d
  CROSS JOIN capacity c
  ORDER BY ds.d;
$$;

-- 4. Recreate fn_monthly_summary with avg_zsn
CREATE OR REPLACE FUNCTION public.fn_monthly_summary(
  p_org_id uuid,
  p_year int,
  p_month int
)
RETURNS TABLE (
  avg_residents numeric,
  avg_zsn numeric,
  total_deaths bigint,
  total_contracts_signed bigint,
  total_contracts_ended bigint,
  net_change bigint,
  total_revenue numeric
)
LANGUAGE sql STABLE
AS $$
  WITH daily AS (
    SELECT * FROM public.fn_daily_report(p_org_id, p_year, p_month)
  ),
  revenue AS (
    SELECT COALESCE(SUM(NULLIF(re.metadata->>'contract_value', '')::numeric), 0) AS rev
    FROM public.resident_events re
    WHERE re.organization_id = p_org_id
      AND re.event_type = 'contract_signed'
      AND EXTRACT(YEAR FROM re.event_date)::int = p_year
      AND EXTRACT(MONTH FROM re.event_date)::int = p_month
  )
  SELECT
    COALESCE(ROUND(AVG(d.total_residents), 2), 0) AS avg_residents,
    COALESCE(ROUND(AVG(d.zsn_count), 2), 0) AS avg_zsn,
    COALESCE(SUM(d.deaths), 0) AS total_deaths,
    COALESCE(SUM(d.contracts_signed), 0) AS total_contracts_signed,
    COALESCE(SUM(d.contracts_ended), 0) AS total_contracts_ended,
    COALESCE(SUM(d.contracts_signed) - SUM(d.contracts_ended) - SUM(d.deaths), 0) AS net_change,
    COALESCE(r.rev, 0) AS total_revenue
  FROM daily d
  CROSS JOIN revenue r
  GROUP BY r.rev;
$$;

-- 5. Recreate fn_occupancy_kpi with zsn stats
CREATE OR REPLACE FUNCTION public.fn_occupancy_kpi(p_org_id uuid)
RETURNS TABLE (
  total_beds bigint,
  occupied_beds bigint,
  free_beds bigint,
  occupancy_rate numeric,
  active_residents bigint,
  zsn_count bigint,
  zsn_percentage numeric,
  deaths_this_month bigint,
  contracts_signed_this_month bigint,
  contracts_ended_this_month bigint
)
LANGUAGE sql STABLE
AS $$
  WITH beds_count AS (
    SELECT COUNT(*)::bigint AS total
    FROM public.beds b
    JOIN public.rooms r ON r.id = b.room_id
    WHERE r.organization_id = p_org_id
      AND b.is_active = true
      AND r.is_active = true
  ),
  occupied AS (
    SELECT COUNT(*)::bigint AS cnt
    FROM public.bed_assignments ba
    JOIN public.residents res ON res.id = ba.resident_id
    WHERE res.organization_id = p_org_id
      AND ba.unassigned_at IS NULL
  ),
  active_res AS (
    SELECT
      COUNT(*)::bigint AS cnt,
      COUNT(*) FILTER (WHERE is_zsn = true)::bigint AS zsn_cnt
    FROM public.residents
    WHERE organization_id = p_org_id
      AND archived_at IS NULL
      AND death_date IS NULL
      AND (contract_end_date IS NULL OR contract_end_date > CURRENT_DATE)
  ),
  this_month_events AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'death') AS deaths,
      COUNT(*) FILTER (WHERE event_type = 'contract_signed') AS signed,
      COUNT(*) FILTER (WHERE event_type = 'contract_ended' AND COALESCE(event_reason, '') <> 'death') AS ended
    FROM public.resident_events
    WHERE organization_id = p_org_id
      AND event_date >= date_trunc('month', CURRENT_DATE)::date
      AND event_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
  )
  SELECT
    COALESCE(b.total, 0) AS total_beds,
    COALESCE(o.cnt, 0) AS occupied_beds,
    GREATEST(COALESCE(b.total, 0) - COALESCE(o.cnt, 0), 0) AS free_beds,
    CASE
      WHEN COALESCE(b.total, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(o.cnt, 0)::numeric / b.total::numeric) * 100, 1)
    END AS occupancy_rate,
    COALESCE(a.cnt, 0) AS active_residents,
    COALESCE(a.zsn_cnt, 0) AS zsn_count,
    CASE
      WHEN COALESCE(a.cnt, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(a.zsn_cnt, 0)::numeric / a.cnt::numeric) * 100, 1)
    END AS zsn_percentage,
    COALESCE(e.deaths, 0) AS deaths_this_month,
    COALESCE(e.signed, 0) AS contracts_signed_this_month,
    COALESCE(e.ended, 0) AS contracts_ended_this_month
  FROM beds_count b
  CROSS JOIN occupied o
  CROSS JOIN active_res a
  CROSS JOIN this_month_events e;
$$;
