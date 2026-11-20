-- Drop existing function signatures before redefining
DROP FUNCTION IF EXISTS get_dashboard_summary(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_dashboard_summary(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_dashboard_summary(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_organization_id UUID DEFAULT NULL,
  p_module TEXT DEFAULT NULL,
  p_issue_type TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
  v_yesterday_start TIMESTAMPTZ := v_today_start - INTERVAL '1 day';
  v_result JSON;
BEGIN
  -- Single-pass materialized CTE: scans public.tickets ONCE instead of 9 separate subqueries
  WITH filtered AS MATERIALIZED (
    SELECT
      id,
      status,
      priority,
      organization_id,
      assigned_agent_id,
      created_at,
      updated_at
    FROM public.tickets
    WHERE created_at >= p_start_date
      AND created_at <= p_end_date
      AND (p_organization_id IS NULL OR organization_id = p_organization_id)
      AND (p_module IS NULL OR module = p_module)
      AND (p_issue_type IS NULL OR issue_type = p_issue_type)
  ),
  base_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= v_today_start) AS total_today,
      COUNT(*) FILTER (WHERE created_at >= v_yesterday_start AND created_at < v_today_start) AS yesterday_count,
      COUNT(*) FILTER (WHERE status = 'New') AS new_tickets,
      COUNT(*) FILTER (WHERE status = 'In Progress') AS in_progress,
      COUNT(*) FILTER (WHERE status = 'Pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'Escalated') AS escalated,
      COUNT(*) FILTER (WHERE status IN ('Resolved', 'Closed')) AS resolved,
      COUNT(*) AS total_all
    FROM filtered
  ),
  avg_csat AS (
    SELECT COALESCE(ROUND(AVG(c.score)::numeric, 2), 0.0) AS val
    FROM public.csat_surveys c
    JOIN filtered f ON c.ticket_id = f.id
    WHERE c.score IS NOT NULL
  ),
  status_agg AS (
    SELECT COALESCE(json_agg(json_build_object('name', status_name, 'value', cnt)), '[]'::json) AS data
    FROM (
      SELECT COALESCE(status, '') AS status_name, COUNT(*) AS cnt
      FROM filtered
      GROUP BY COALESCE(status, '')
    ) s
  ),
  priority_agg AS (
    SELECT COALESCE(json_agg(json_build_object('name', priority_name, 'value', cnt)), '[]'::json) AS data
    FROM (
      SELECT COALESCE(priority, 'Medium') AS priority_name, COUNT(*) AS cnt
      FROM filtered
      GROUP BY COALESCE(priority, 'Medium')
    ) p
  ),
  org_agg AS (
    SELECT COALESCE(json_agg(json_build_object('name', org_name, 'value', cnt)), '[]'::json) AS data
    FROM (
      SELECT COALESCE(o.name, 'Unknown') AS org_name, COUNT(f.id) AS cnt
      FROM filtered f
      LEFT JOIN public.organizations o ON f.organization_id = o.id
      GROUP BY COALESCE(o.name, 'Unknown')
      ORDER BY cnt DESC
      LIMIT 8
    ) o_q
  ),
  agent_agg AS (
    SELECT COALESCE(json_agg(json_build_object('name', agent_name, 'value', cnt)), '[]'::json) AS data
    FROM (
      SELECT COALESCE(p.full_name, f.assigned_agent_id::text) AS agent_name, COUNT(f.id) AS cnt
      FROM filtered f
      LEFT JOIN public.profiles p ON f.assigned_agent_id = p.id
      WHERE f.assigned_agent_id IS NOT NULL
      GROUP BY COALESCE(p.full_name, f.assigned_agent_id::text)
      ORDER BY cnt DESC
      LIMIT 5
    ) a_q
  ),
  created_by_day AS (
    SELECT COALESCE(json_object_agg(date_key, cnt), '{}'::json) AS data
    FROM (
      SELECT to_char(created_at, 'YYYY-MM-DD') AS date_key, COUNT(*) AS cnt
      FROM filtered
      GROUP BY to_char(created_at, 'YYYY-MM-DD')
    ) c_q
  ),
  resolved_by_day AS (
    SELECT COALESCE(json_object_agg(date_key, cnt), '{}'::json) AS data
    FROM (
      SELECT to_char(updated_at, 'YYYY-MM-DD') AS date_key, COUNT(*) AS cnt
      FROM filtered
      WHERE status IN ('Resolved', 'Closed')
        AND updated_at IS NOT NULL
      GROUP BY to_char(updated_at, 'YYYY-MM-DD')
    ) r_q
  ),
  heatmap_agg AS (
    SELECT COALESCE(json_agg(json_build_object('dow', dow, 'hour', hour, 'cnt', cnt)), '[]'::json) AS data
    FROM (
      SELECT
        EXTRACT(DOW FROM created_at)::int AS dow,
        EXTRACT(HOUR FROM created_at)::int AS hour,
        COUNT(*) AS cnt
      FROM filtered
      GROUP BY 1, 2
      ORDER BY 1, 2
    ) h_q
  )
  SELECT json_build_object(
    'stats', json_build_object(
      'totalToday', bs.total_today,
      'yesterdayCount', bs.yesterday_count,
      'newTickets', bs.new_tickets,
      'inProgress', bs.in_progress,
      'pending', bs.pending,
      'escalated', bs.escalated,
      'resolved', bs.resolved,
      'totalAll', bs.total_all,
      'avgCsat', ac.val
    ),
    'statusData', sa.data,
    'priorityData', pa.data,
    'organizationData', oa.data,
    'agentData', aa.data,
    'createdCountsByDay', cd.data,
    'resolvedCountsByDay', rd.data,
    'heatmapData', ha.data
  ) INTO v_result
  FROM base_stats bs
  CROSS JOIN avg_csat ac
  CROSS JOIN status_agg sa
  CROSS JOIN priority_agg pa
  CROSS JOIN org_agg oa
  CROSS JOIN agent_agg aa
  CROSS JOIN created_by_day cd
  CROSS JOIN resolved_by_day rd
  CROSS JOIN heatmap_agg ha;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
