CREATE OR REPLACE FUNCTION get_dashboard_summary(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_hospital_id UUID DEFAULT NULL,
  p_module TEXT DEFAULT NULL,
  p_issue_type TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
  v_yesterday_start TIMESTAMPTZ := v_today_start - INTERVAL '1 day';
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'stats', json_build_object(
      'totalToday', COUNT(*) FILTER (WHERE created_at >= v_today_start AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id) AND (p_module IS NULL OR module = p_module) AND (p_issue_type IS NULL OR issue_type = p_issue_type)),
      'yesterdayCount', COUNT(*) FILTER (WHERE created_at >= v_yesterday_start AND created_at < v_today_start AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id) AND (p_module IS NULL OR module = p_module) AND (p_issue_type IS NULL OR issue_type = p_issue_type)),
      'newTickets', COUNT(*) FILTER (WHERE status = 'New' AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id) AND (p_module IS NULL OR module = p_module) AND (p_issue_type IS NULL OR issue_type = p_issue_type)),
      'inProgress', COUNT(*) FILTER (WHERE status = 'In Progress' AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id) AND (p_module IS NULL OR module = p_module) AND (p_issue_type IS NULL OR issue_type = p_issue_type)),
      'pending', COUNT(*) FILTER (WHERE status = 'Pending' AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id) AND (p_module IS NULL OR module = p_module) AND (p_issue_type IS NULL OR issue_type = p_issue_type)),
      'escalated', COUNT(*) FILTER (WHERE status = 'Escalated' AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id) AND (p_module IS NULL OR module = p_module) AND (p_issue_type IS NULL OR issue_type = p_issue_type)),
      'resolved', COUNT(*) FILTER (WHERE status IN ('Resolved', 'Closed') AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id) AND (p_module IS NULL OR module = p_module) AND (p_issue_type IS NULL OR issue_type = p_issue_type)),
      'totalAll', COUNT(*),
      'avgCsat', COALESCE((
        SELECT ROUND(AVG(score)::numeric, 2)
        FROM csat_surveys c
        JOIN tickets t ON c.ticket_id = t.id
        WHERE t.created_at >= p_start_date AND t.created_at <= p_end_date 
          AND (p_hospital_id IS NULL OR t.hospital_id = p_hospital_id)
          AND (p_module IS NULL OR t.module = p_module)
          AND (p_issue_type IS NULL OR t.issue_type = p_issue_type)
          AND c.score IS NOT NULL
      ), 0.0)
    ),
    'statusData', COALESCE((
      SELECT json_agg(json_build_object('name', status_name, 'value', cnt))
      FROM (
        SELECT COALESCE(status, '') as status_name, COUNT(*) as cnt
        FROM tickets
        WHERE created_at >= p_start_date AND created_at <= p_end_date
          AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
          AND (p_module IS NULL OR module = p_module)
          AND (p_issue_type IS NULL OR issue_type = p_issue_type)
        GROUP BY COALESCE(status, '')
      ) s
    ), '[]'::json),
    'priorityData', COALESCE((
      SELECT json_agg(json_build_object('name', priority_name, 'value', cnt))
      FROM (
        SELECT COALESCE(priority, 'Medium') as priority_name, COUNT(*) as cnt
        FROM tickets
        WHERE created_at >= p_start_date AND created_at <= p_end_date
          AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
          AND (p_module IS NULL OR module = p_module)
          AND (p_issue_type IS NULL OR issue_type = p_issue_type)
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
          AND (p_hospital_id IS NULL OR t.hospital_id = p_hospital_id)
          AND (p_module IS NULL OR t.module = p_module)
          AND (p_issue_type IS NULL OR t.issue_type = p_issue_type)
        GROUP BY COALESCE(h.name, 'Unknown')
        ORDER BY cnt DESC
        LIMIT 8
      ) h_q
    ), '[]'::json),
    'agentData', COALESCE((
      SELECT json_agg(json_build_object('name', agent_name, 'value', cnt))
      FROM (
        SELECT COALESCE(p.full_name, t.assigned_agent_id::text) as agent_name, COUNT(t.id) as cnt
        FROM tickets t
        LEFT JOIN profiles p ON t.assigned_agent_id = p.id
        WHERE t.created_at >= p_start_date AND t.created_at <= p_end_date
          AND t.assigned_agent_id IS NOT NULL
          AND (p_hospital_id IS NULL OR t.hospital_id = p_hospital_id)
          AND (p_module IS NULL OR t.module = p_module)
          AND (p_issue_type IS NULL OR t.issue_type = p_issue_type)
        GROUP BY COALESCE(p.full_name, t.assigned_agent_id::text)
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
          AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
          AND (p_module IS NULL OR module = p_module)
          AND (p_issue_type IS NULL OR issue_type = p_issue_type)
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
          AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
          AND (p_module IS NULL OR module = p_module)
          AND (p_issue_type IS NULL OR issue_type = p_issue_type)
        GROUP BY to_char(updated_at, 'YYYY-MM-DD')
      ) r_q
    ), '{}'::json)
  ) INTO v_result
  FROM tickets
  WHERE created_at >= p_start_date AND created_at <= p_end_date
    AND (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
    AND (p_module IS NULL OR module = p_module)
    AND (p_issue_type IS NULL OR issue_type = p_issue_type);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
