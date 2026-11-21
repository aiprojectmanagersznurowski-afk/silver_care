-- @REQ: SUP-FEATURE-FLAGS
-- Keep the existing BI queries under invoker RLS. Check the module before reading any rows.

CREATE OR REPLACE FUNCTION public.fn_care_level_stats(p_org_id uuid)
RETURNS TABLE (
  care_level text,
  resident_count bigint
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_org_feature(p_org_id, 'module_voice_and_reports') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
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
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_contract_end_reasons(
  p_org_id uuid,
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int
)
RETURNS TABLE (
  end_reason text,
  event_month int,
  cnt bigint
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_org_feature(p_org_id, 'module_voice_and_reports') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
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
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_deaths_by_stay_length(p_org_id uuid)
RETURNS TABLE (
  stay_range text,
  cnt bigint
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_org_feature(p_org_id, 'module_voice_and_reports') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
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
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_admissions_by_month_care_level(
  p_org_id uuid,
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int
)
RETURNS TABLE (
  admission_month int,
  care_level text,
  cnt bigint
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_org_feature(p_org_id, 'module_voice_and_reports') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
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
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_contract_sources(
  p_org_id uuid,
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int
)
RETURNS TABLE (
  source text,
  cnt bigint
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_org_feature(p_org_id, 'module_voice_and_reports') THEN
    RAISE EXCEPTION 'FEATURE_DISABLED_FOR_ORG' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
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
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.fn_care_level_stats(uuid),
  public.fn_contract_end_reasons(uuid, integer),
  public.fn_deaths_by_stay_length(uuid),
  public.fn_admissions_by_month_care_level(uuid, integer),
  public.fn_contract_sources(uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.fn_care_level_stats(uuid),
  public.fn_contract_end_reasons(uuid, integer),
  public.fn_deaths_by_stay_length(uuid),
  public.fn_admissions_by_month_care_level(uuid, integer),
  public.fn_contract_sources(uuid, integer)
  TO authenticated, service_role;
