-- =============================================================
-- Optimization Index Pack (CSAT & Analytics Aggregation RPC)
-- =============================================================

BEGIN;

-- 1. Create Index on csat_surveys created_at to speed up date-range queries
CREATE INDEX IF NOT EXISTS idx_csat_surveys_created_at 
  ON public.csat_surveys (created_at DESC);

-- 2. Drop existing RPC if exists
DROP FUNCTION IF EXISTS public.get_analytics_dashboard_v2(text, text);

-- 3. Create RPC Function to aggregate all dashboard metrics in ONE database call
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
  total_records INT;
  status_json JSON;
  priority_json JSON;
  trend_json JSON;
  category_json JSON;
  peak_json JSON;
  resolution_json JSON;
  csat_json JSON;
  sla_json JSON;
BEGIN
  -- Standardize input dates to full timestamps in UTC
  start_dt := (start_date || ' 00:00:00+00')::timestamptz;
  end_dt := (end_date || ' 23:59:59+00')::timestamptz;

  -- 1. Total records count
  SELECT COUNT(*) INTO total_records 
  FROM public.tickets 
  WHERE created_at >= start_dt AND created_at <= end_dt;

  -- 2. Status data count
  SELECT COALESCE(json_agg(t), '[]'::json) INTO status_json
  FROM (
    SELECT status AS name, COUNT(*) AS value
    FROM public.tickets
    WHERE created_at >= start_dt AND created_at <= end_dt
    GROUP BY status
    ORDER BY value DESC
  ) t;

  -- 3. Priority data count
  SELECT COALESCE(json_agg(t), '[]'::json) INTO priority_json
  FROM (
    SELECT priority AS name, COUNT(*) AS value
    FROM public.tickets
    WHERE created_at >= start_dt AND created_at <= end_dt
    GROUP BY priority
    ORDER BY value DESC
  ) t;

  -- 4. Trend data count (Grouped by date, sorted chronologically)
  SELECT COALESCE(json_agg(t), '[]'::json) INTO trend_json
  FROM (
    SELECT 
      to_char(created_at, 'DD Mon') AS name, 
      COUNT(*) AS value
    FROM public.tickets
    WHERE created_at >= start_dt AND created_at <= end_dt
    GROUP BY to_char(created_at, 'YYYY-MM-DD'), to_char(created_at, 'DD Mon')
    ORDER BY to_char(created_at, 'YYYY-MM-DD')
  ) t;

  -- 5. Category data (standardizing issue_type or subject prefix, top 12)
  SELECT COALESCE(json_agg(t), '[]'::json) INTO category_json
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
      FROM public.tickets
      WHERE created_at >= start_dt AND created_at <= end_dt
    ) sub
    GROUP BY name
    ORDER BY value DESC
    LIMIT 12
  ) t;

  -- 6. Peak Hours volume (Hourly distribution in Asia/Bangkok time)
  SELECT COALESCE(json_agg(t), '[]'::json) INTO peak_json
  FROM (
    SELECT (h.hour || ':00') AS name, COALESCE(c.val, 0) AS value
    FROM generate_series(0, 23) AS h(hour)
    LEFT JOIN (
      SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bangkok') AS hr, COUNT(*) AS val
      FROM public.tickets
      WHERE created_at >= start_dt AND created_at <= end_dt
      GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bangkok')
    ) c ON h.hour = c.hr
    ORDER BY h.hour
  ) t;

  -- 7. Resolution Times for resolved tickets (latest 10)
  SELECT COALESCE(json_agg(t), '[]'::json) INTO resolution_json
  FROM (
    SELECT 
      ticket_no AS name, 
      round((extract(epoch from (resolved_at - created_at))/3600)::numeric, 1) AS value
    FROM public.tickets
    WHERE created_at >= start_dt AND created_at <= end_dt AND resolved_at IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 10
  ) t;

  -- 8. CSAT Trend distribution (scores 1-5)
  SELECT COALESCE(json_agg(t), '[]'::json) INTO csat_json
  FROM (
    SELECT ('Score ' || score) AS name, COUNT(*) AS value
    FROM public.csat_surveys
    WHERE created_at >= start_dt AND created_at <= end_dt AND score IS NOT NULL
    GROUP BY score
    ORDER BY score
  ) t;

  -- 9. SLA Compliance (Compliant = resolved in < 24 hrs or unresolved, Breached = resolved >= 24 hrs)
  SELECT json_build_array(
    json_build_object(
      'name', 'Compliant', 
      'value', COALESCE(sum(case when resolved_at IS NULL OR extract(epoch from (resolved_at - created_at))/3600 < 24 then 1 else 0 end), 0)
    ),
    json_build_object(
      'name', 'Breached', 
      'value', COALESCE(sum(case when resolved_at IS NOT NULL AND extract(epoch from (resolved_at - created_at))/3600 >= 24 then 1 else 0 end), 0)
    )
  ) INTO sla_json
  FROM public.tickets
  WHERE created_at >= start_dt AND created_at <= end_dt;

  -- Return everything packaged in a single JSON object
  RETURN json_build_object(
    'total_records', total_records,
    'status_data', status_json,
    'priority_data', priority_json,
    'trend_data', trend_json,
    'category_data', category_json,
    'peak_data', peak_json,
    'resolution_data', resolution_json,
    'csat_data', csat_json,
    'sla_data', sla_json
  );
END;
$$;

COMMIT;
