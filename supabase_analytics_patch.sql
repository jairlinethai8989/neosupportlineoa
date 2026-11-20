-- =============================================================
-- Optimization Index Pack (CSAT & Analytics Aggregation RPC v2)
-- Single-pass CTE rewrite: scans public.tickets ONCE instead of 8 times
-- =============================================================

BEGIN;

-- 1. Create Index on csat_surveys created_at to speed up date-range queries
CREATE INDEX IF NOT EXISTS idx_csat_surveys_created_at
  ON public.csat_surveys (created_at DESC);

-- 2. Drop existing RPC if exists
DROP FUNCTION IF EXISTS public.get_analytics_dashboard_v2(text, text);

-- 3. Create single-pass CTE RPC function to aggregate all analytics metrics in ONE scan
CREATE OR REPLACE FUNCTION public.get_analytics_dashboard_v2(
  start_date TEXT,
  end_date TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_dt TIMESTAMPTZ;
  end_dt TIMESTAMPTZ;
  v_result JSON;
BEGIN
  -- Standardize input dates to full timestamps in UTC
  start_dt := (start_date || ' 00:00:00+00')::timestamptz;
  end_dt := (end_date || ' 23:59:59+00')::timestamptz;

  WITH filtered AS MATERIALIZED (
    SELECT
      ticket_no,
      status,
      priority,
      issue_type,
      subject,
      created_at,
      resolved_at
    FROM public.tickets
    WHERE created_at >= start_dt
      AND created_at <= end_dt
  ),
  total_cnt AS (
    SELECT COUNT(*)::int AS val FROM filtered
  ),
  status_agg AS (
    SELECT COALESCE(json_agg(t), '[]'::json) AS data
    FROM (
      SELECT status AS name, COUNT(*) AS value
      FROM filtered
      GROUP BY status
      ORDER BY value DESC
    ) t
  ),
  priority_agg AS (
    SELECT COALESCE(json_agg(t), '[]'::json) AS data
    FROM (
      SELECT priority AS name, COUNT(*) AS value
      FROM filtered
      GROUP BY priority
      ORDER BY value DESC
    ) t
  ),
  trend_agg AS (
    SELECT COALESCE(json_agg(t), '[]'::json) AS data
    FROM (
      SELECT
        to_char(created_at, 'DD Mon') AS name,
        COUNT(*) AS value
      FROM filtered
      GROUP BY to_char(created_at, 'YYYY-MM-DD'), to_char(created_at, 'DD Mon')
      ORDER BY to_char(created_at, 'YYYY-MM-DD')
    ) t
  ),
  category_agg AS (
    SELECT COALESCE(json_agg(t), '[]'::json) AS data
    FROM (
      SELECT name, COUNT(*) AS value
      FROM (
        SELECT
          CASE
            WHEN trim(COALESCE(issue_type, '')) <> '' THEN trim(issue_type)
            WHEN position(':' in subject) > 0 THEN trim(substring(subject from 1 for position(':' in subject) - 1))
            WHEN trim(COALESCE(subject, '')) = '' THEN 'Other'
            ELSE trim(subject)
          END AS name
        FROM filtered
      ) sub
      GROUP BY name
      ORDER BY value DESC
      LIMIT 12
    ) t
  ),
  peak_agg AS (
    SELECT COALESCE(json_agg(t), '[]'::json) AS data
    FROM (
      SELECT (h.hour || ':00') AS name, COALESCE(c.val, 0) AS value
      FROM generate_series(0, 23) AS h(hour)
      LEFT JOIN (
        SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bangkok')::int AS hr, COUNT(*) AS val
        FROM filtered
        GROUP BY 1
      ) c ON h.hour = c.hr
      ORDER BY h.hour
    ) t
  ),
  resolution_agg AS (
    SELECT COALESCE(json_agg(t), '[]'::json) AS data
    FROM (
      SELECT
        ticket_no AS name,
        round((extract(epoch from (resolved_at - created_at)) / 3600)::numeric, 1) AS value
      FROM filtered
      WHERE resolved_at IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    ) t
  ),
  csat_agg AS (
    SELECT COALESCE(json_agg(t), '[]'::json) AS data
    FROM (
      SELECT ('Score ' || score) AS name, COUNT(*) AS value
      FROM public.csat_surveys
      WHERE created_at >= start_dt
        AND created_at <= end_dt
        AND score IS NOT NULL
      GROUP BY score
      ORDER BY score
    ) t
  ),
  sla_agg AS (
    SELECT json_build_array(
      json_build_object(
        'name', 'Compliant',
        'value', COALESCE(sum(case when resolved_at IS NULL OR extract(epoch from (resolved_at - created_at)) / 3600 < 24 then 1 else 0 end), 0)
      ),
      json_build_object(
        'name', 'Breached',
        'value', COALESCE(sum(case when resolved_at IS NOT NULL AND extract(epoch from (resolved_at - created_at)) / 3600 >= 24 then 1 else 0 end), 0)
      )
    ) AS data
    FROM filtered
  )
  SELECT json_build_object(
    'total_records', tc.val,
    'status_data', sa.data,
    'priority_data', pa.data,
    'trend_data', ta.data,
    'category_data', ca.data,
    'peak_data', pk.data,
    'resolution_data', ra.data,
    'csat_data', cs.data,
    'sla_data', sl.data
  ) INTO v_result
  FROM total_cnt tc
  CROSS JOIN status_agg sa
  CROSS JOIN priority_agg pa
  CROSS JOIN trend_agg ta
  CROSS JOIN category_agg ca
  CROSS JOIN peak_agg pk
  CROSS JOIN resolution_agg ra
  CROSS JOIN csat_agg cs
  CROSS JOIN sla_agg sl;

  RETURN v_result;
END;
$$;

COMMIT;
