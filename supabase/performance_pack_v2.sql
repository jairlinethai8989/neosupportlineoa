-- ==============================================================================
-- Neo Support Performance Pack v2 (All-in-One Idempotent Migration)
-- 1. Core Composite & Partial Indexes for Dashboard, Inbox, Tickets, SLA, Customers
-- 2. Single-Pass CTE RPC: public.get_dashboard_summary
-- 3. Single-Pass CTE RPC: public.get_analytics_dashboard_v2
-- 4. Table ANALYZE so Postgres Planner uses the new indexes immediately
--
-- Safe to run multiple times in Supabase SQL Editor.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- PART 1: PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------

-- Dashboard & Analytics date-range + filter scans
CREATE INDEX IF NOT EXISTS idx_tickets_created_org_status
  ON public.tickets (created_at DESC, organization_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_created_org_module
  ON public.tickets (created_at DESC, organization_id, module, issue_type);

CREATE INDEX IF NOT EXISTS idx_tickets_status_created_at_desc
  ON public.tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_status_resolved_at_desc
  ON public.tickets (status, resolved_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_resolved_updated
  ON public.tickets (updated_at DESC, organization_id)
  WHERE status IN ('Resolved', 'Closed');

-- Agent Analytics & Personal Dashboard
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_agent_status
  ON public.tickets (assigned_agent_id, status)
  WHERE assigned_agent_id IS NOT NULL;

-- SLA Notification Polling (fetchSlaBreaches)
CREATE INDEX IF NOT EXISTS idx_tickets_sla_due_active
  ON public.tickets (sla_due_at ASC)
  WHERE status NOT IN ('Resolved', 'Closed') AND sla_due_at IS NOT NULL;

-- Inbox Active Conversations (matches .eq('status', 'active') ORDER BY last_message_at DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_conversations_active_last_message_id_desc
  ON public.conversations (last_message_at DESC NULLS LAST, id DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_conversations_ticket_status
  ON public.conversations (current_ticket_id, status)
  WHERE current_ticket_id IS NOT NULL;

-- Messages & Timeline Logs
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at_desc
  ON public.messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_logs_created_at_desc
  ON public.ticket_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_logs_ticket_created_at_desc
  ON public.ticket_logs (ticket_id, created_at DESC);

-- Customers & CSAT Surveys
CREATE INDEX IF NOT EXISTS idx_customers_created_at_desc
  ON public.customers (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_csat_surveys_ticket_id
  ON public.csat_surveys (ticket_id);

CREATE INDEX IF NOT EXISTS idx_csat_surveys_created_at
  ON public.csat_surveys (created_at DESC);

-- ------------------------------------------------------------------------------
-- PART 2: SINGLE-PASS CTE RPC — get_dashboard_summary
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_dashboard_summary(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_summary(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_organization_id UUID DEFAULT NULL,
  p_module TEXT DEFAULT NULL,
  p_issue_type TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
  v_yesterday_start TIMESTAMPTZ := v_today_start - INTERVAL '1 day';
  v_result JSON;
BEGIN
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
$$;

-- ------------------------------------------------------------------------------
-- PART 3: SINGLE-PASS CTE RPC — get_analytics_dashboard_v2
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_analytics_dashboard_v2(TEXT, TEXT);

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

-- Refresh table statistics outside transaction block
ANALYZE public.tickets;
ANALYZE public.conversations;
ANALYZE public.messages;
ANALYZE public.ticket_logs;
ANALYZE public.customers;
ANALYZE public.csat_surveys;
