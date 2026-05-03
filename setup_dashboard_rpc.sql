-- Supabase RPC Function to get dashboard summary efficiently
-- Drop existing if exists
DROP FUNCTION IF EXISTS get_dashboard_summary(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_dashboard_summary(p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)
RETURNS JSON AS $$
DECLARE
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
  v_yesterday_start TIMESTAMPTZ := v_today_start - INTERVAL '1 day';
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'stats', json_build_object(
      'totalToday', COUNT(*) FILTER (WHERE created_at >= v_today_start),
      'yesterdayCount', COUNT(*) FILTER (WHERE created_at >= v_yesterday_start AND created_at < v_today_start),
      'newTickets', COUNT(*) FILTER (WHERE status = 'New'),
      'inProgress', COUNT(*) FILTER (WHERE status = 'In Progress'),
      'pending', COUNT(*) FILTER (WHERE status = 'Pending'),
      'escalated', COUNT(*) FILTER (WHERE status = 'Escalated'),
      'resolved', COUNT(*) FILTER (WHERE status IN ('Resolved', 'Closed')),
      'totalAll', COUNT(*)
    ),
    'statusData', COALESCE((
      SELECT json_agg(json_build_object('name', status_name, 'value', cnt))
      FROM (
        SELECT COALESCE(status, '') as status_name, COUNT(*) as cnt
        FROM tickets
        WHERE created_at >= p_start_date AND created_at <= p_end_date
        GROUP BY COALESCE(status, '')
      ) s
    ), '[]'::json),
    'priorityData', COALESCE((
      SELECT json_agg(json_build_object('name', priority_name, 'value', cnt))
      FROM (
        SELECT COALESCE(priority, 'Medium') as priority_name, COUNT(*) as cnt
        FROM tickets
        WHERE created_at >= p_start_date AND created_at <= p_end_date
        GROUP BY COALESCE(priority, 'Medium')
      ) p
    ), '[]'::json),
    'hospitalData', COALESCE((
      SELECT json_agg(json_build_object('name', hosp_name, 'value', cnt))
      FROM (
        SELECT COALESCE(h.name, 'Unknown') as hosp_name, COUNT(t.id) as cnt
        FROM tickets t
        LEFT JOIN hospitals h ON t.hospital_id = h.id
        WHERE t.created_at >= p_start_date AND t.created_at <= p_end_date
        GROUP BY COALESCE(h.name, 'Unknown')
        ORDER BY cnt DESC
        LIMIT 8
      ) h_q
    ), '[]'::json),
    'agentData', COALESCE((
      SELECT json_agg(json_build_object('name', agent_name, 'value', cnt))
      FROM (
        SELECT COALESCE(p.full_name, t.assigned_agent_id) as agent_name, COUNT(t.id) as cnt
        FROM tickets t
        LEFT JOIN profiles p ON t.assigned_agent_id = p.id
        WHERE t.created_at >= p_start_date AND t.created_at <= p_end_date
          AND t.assigned_agent_id IS NOT NULL
        GROUP BY COALESCE(p.full_name, t.assigned_agent_id)
        ORDER BY cnt DESC
        LIMIT 5
      ) a_q
    ), '[]'::json),
    'createdCountsByDay', COALESCE((
      SELECT json_object_agg(date_key, cnt)
      FROM (
        SELECT to_char(created_at, 'YYYY-MM-DD') as date_key, COUNT(*) as cnt
        FROM tickets
        WHERE created_at >= p_start_date AND created_at <= p_end_date
        GROUP BY to_char(created_at, 'YYYY-MM-DD')
      ) c_q
    ), '{}'::json),
    'resolvedCountsByDay', COALESCE((
      SELECT json_object_agg(date_key, cnt)
      FROM (
        SELECT to_char(updated_at, 'YYYY-MM-DD') as date_key, COUNT(*) as cnt
        FROM tickets
        WHERE created_at >= p_start_date AND created_at <= p_end_date
          AND status IN ('Resolved', 'Closed')
          AND updated_at IS NOT NULL
        GROUP BY to_char(updated_at, 'YYYY-MM-DD')
      ) r_q
    ), '{}'::json)
  ) INTO v_result
  FROM tickets
  WHERE created_at >= p_start_date AND created_at <= p_end_date;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
