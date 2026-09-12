-- Migration: 20260912211000_reporting_views.sql
-- SQL views and functions for BI reporting (Dane Dzienne + Statystyka)

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Daily report function — returns aggregated data per day for a given month
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_daily_report(
  p_org_id uuid,
  p_year int,
  p_month int
)
RETURNS TABLE (
  report_date date,
  total_residents bigint,
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
  -- Count active residents per day: residents with admission_date <= d
  -- and no contract_end_date or contract_end_date > d, and no death_date or death_date > d
  daily_residents AS (
    SELECT
      ds.d,
      COUNT(*)::bigint AS total
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Statistics: care level breakdown
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_care_level_stats(p_org_id uuid)
RETURNS TABLE (
  care_level text,
  resident_count bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(r.care_level, 'unknown') AS care_level,
    COUNT(*) AS resident_count
  FROM public.residents r
  WHERE r.organization_id = p_org_id
    AND r.archived_at IS NULL
    AND r.death_date IS NULL
    AND (r.contract_end_date IS NULL OR r.contract_end_date > CURRENT_DATE)
  GROUP BY r.care_level
  ORDER BY
    CASE r.care_level
      WHEN 'walking' THEN 1
      WHEN 'sitting' THEN 2
      WHEN 'bedridden' THEN 3
      WHEN 'hospice' THEN 4
      ELSE 5
    END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Statistics: occupancy KPI
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_occupancy_kpi(p_org_id uuid)
RETURNS TABLE (
  total_beds bigint,
  occupied_beds bigint,
  free_beds bigint,
  occupancy_rate numeric,
  active_residents bigint,
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
    SELECT COUNT(*)::bigint AS cnt
    FROM public.residents r
    WHERE r.organization_id = p_org_id
      AND r.archived_at IS NULL
      AND r.death_date IS NULL
      AND (r.contract_end_date IS NULL OR r.contract_end_date > CURRENT_DATE)
  ),
  month_events AS (
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
    bc.total AS total_beds,
    occ.cnt AS occupied_beds,
    bc.total - occ.cnt AS free_beds,
    CASE WHEN bc.total > 0
      THEN ROUND((occ.cnt::numeric / bc.total) * 100, 1)
      ELSE 0
    END AS occupancy_rate,
    ar.cnt AS active_residents,
    me.deaths AS deaths_this_month,
    me.signed AS contracts_signed_this_month,
    me.ended AS contracts_ended_this_month
  FROM beds_count bc, occupied occ, active_res ar, month_events me;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Statistics: contract end reasons breakdown
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_contract_end_reasons(
  p_org_id uuid,
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int
)
RETURNS TABLE (
  end_reason text,
  event_month int,
  cnt bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(re.event_reason, 'Nieznany') AS end_reason,
    EXTRACT(MONTH FROM re.event_date)::int AS event_month,
    COUNT(*) AS cnt
  FROM public.resident_events re
  WHERE re.organization_id = p_org_id
    AND re.event_type = 'contract_ended'
    AND EXTRACT(YEAR FROM re.event_date)::int = p_year
  GROUP BY re.event_reason, EXTRACT(MONTH FROM re.event_date)
  ORDER BY event_month, end_reason;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Statistics: deaths by length of stay
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_deaths_by_stay_length(p_org_id uuid)
RETURNS TABLE (
  stay_range text,
  cnt bigint
)
LANGUAGE sql STABLE
AS $$
  WITH stays AS (
    SELECT
      CASE
        WHEN (r.death_date - r.admission_date) > 730 THEN '>2 lata'
        WHEN (r.death_date - r.admission_date) > 365 THEN '1-2 lata'
        WHEN (r.death_date - r.admission_date) > 180 THEN '181-365 dni'
        WHEN (r.death_date - r.admission_date) > 90 THEN '91-180 dni'
        WHEN (r.death_date - r.admission_date) > 30 THEN '31-90 dni'
        ELSE '≤30 dni'
      END AS stay_range
    FROM public.residents r
    WHERE r.organization_id = p_org_id
      AND r.death_date IS NOT NULL
      AND r.admission_date IS NOT NULL
  )
  SELECT
    s.stay_range,
    COUNT(*) AS cnt
  FROM stays s
  GROUP BY s.stay_range
  ORDER BY
    CASE s.stay_range
      WHEN '≤30 dni' THEN 1
      WHEN '31-90 dni' THEN 2
      WHEN '91-180 dni' THEN 3
      WHEN '181-365 dni' THEN 4
      WHEN '1-2 lata' THEN 5
      WHEN '>2 lata' THEN 6
    END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Statistics: admissions by month and care level
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_admissions_by_month_care_level(
  p_org_id uuid,
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int
)
RETURNS TABLE (
  admission_month int,
  care_level text,
  cnt bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    EXTRACT(MONTH FROM r.admission_date)::int AS admission_month,
    COALESCE(r.care_level, 'unknown') AS care_level,
    COUNT(*) AS cnt
  FROM public.residents r
  WHERE r.organization_id = p_org_id
    AND r.admission_date IS NOT NULL
    AND EXTRACT(YEAR FROM r.admission_date)::int = p_year
  GROUP BY EXTRACT(MONTH FROM r.admission_date), r.care_level
  ORDER BY admission_month, care_level;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Statistics: contract sources breakdown
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_contract_sources(
  p_org_id uuid,
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int
)
RETURNS TABLE (
  source text,
  cnt bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(r.contract_source, 'Nieznane') AS source,
    COUNT(*) AS cnt
  FROM public.residents r
  WHERE r.organization_id = p_org_id
    AND r.archived_at IS NULL
    AND r.contract_start_date IS NOT NULL
    AND EXTRACT(YEAR FROM r.contract_start_date)::int = p_year
  GROUP BY r.contract_source
  ORDER BY cnt DESC;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. Monthly summary function for daily report header
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_monthly_summary(
  p_org_id uuid,
  p_year int,
  p_month int
)
RETURNS TABLE (
  avg_residents numeric,
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
    COALESCE(SUM(d.deaths), 0) AS total_deaths,
    COALESCE(SUM(d.contracts_signed), 0) AS total_contracts_signed,
    COALESCE(SUM(d.contracts_ended), 0) AS total_contracts_ended,
    COALESCE(SUM(d.contracts_signed) - SUM(d.contracts_ended) - SUM(d.deaths), 0) AS net_change,
    COALESCE(r.rev, 0) AS total_revenue
  FROM daily d
  CROSS JOIN revenue r
  GROUP BY r.rev;
$$;
