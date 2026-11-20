-- ==============================================================================
-- Neo Support Intelligence: Multi-Project & Multi-LINE OA SaaS Migration (v1)
-- Supports:
--   1. Multiple Projects, each with its own LINE OA, LIFF ID, Staff Group & Branding
--   2. Many-to-Many Staff RBAC via public.project_members
--   3. Hybrid Master Data (Global shared items where project_id IS NULL + Project-specific items)
--   4. Internal Notes (messages.is_internal)
--   5. Project-scoped RPCs: get_dashboard_summary, get_analytics_dashboard_v2, claim_ticket_secure
--   6. Safe zero-downtime backfill to Default Project ('default')
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PROJECTS & PROJECT MEMBERS TABLES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  organization_label TEXT NOT NULL DEFAULT 'หน่วยงาน',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0066ff',
  line_channel_id TEXT,
  line_channel_secret TEXT,
  line_channel_access_token TEXT,
  line_liff_id TEXT,
  line_bot_id TEXT,
  line_staff_group_id TEXT,
  notify_on_customer_message BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL DEFAULT 'agent' CHECK (project_role IN ('lead', 'agent', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, profile_id)
);

-- Only one default project allowed
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_single_default
  ON public.projects (is_default)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_projects_slug
  ON public.projects (slug)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_project_members_profile
  ON public.project_members (profile_id, project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_project
  ON public.project_members (project_id, profile_id);

-- Ensure Default Project exists (backwards compatibility for existing single-OA setup)
INSERT INTO public.projects (slug, name, code, organization_label, is_default, is_active)
SELECT 'default', 'Neo Support (Default)', 'NEO', 'โรงพยาบาล', true, true
WHERE NOT EXISTS (SELECT 1 FROM public.projects WHERE is_default = true)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. RLS POLICIES FOR PROJECTS & PROJECT_MEMBERS (SECRETS PROTECTED)
-- ------------------------------------------------------------------------------

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Protect LINE secrets from anon / unauthorized client reads.
-- Browser clients read public portal config via /api/portal/project-config and authorized projects via /api/projects/mine.
REVOKE ALL ON public.projects FROM anon;
REVOKE SELECT (line_channel_secret, line_channel_access_token) ON public.projects FROM authenticated;

DROP POLICY IF EXISTS "Admins and assigned members can view projects" ON public.projects;
CREATE POLICY "Admins and assigned members can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Administrator'
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Administrators can manage projects" ON public.projects;
CREATE POLICY "Administrators can manage projects"
  ON public.projects FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Administrator'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Administrator'
    )
  );

DROP POLICY IF EXISTS "Users can view own project memberships or admin all" ON public.project_members;
CREATE POLICY "Users can view own project memberships or admin all"
  ON public.project_members FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Administrator'
    )
  );

DROP POLICY IF EXISTS "Administrators can manage project memberships" ON public.project_members;
CREATE POLICY "Administrators can manage project memberships"
  ON public.project_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Administrator'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Administrator'
    )
  );

-- ------------------------------------------------------------------------------
-- 3. ADD project_id & is_internal COLUMNS + BACKFILL EXISTING DATA
-- ------------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT;

-- Hybrid Master Data (NULL = Global Shared across all projects, UUID = Project-specific)
ALTER TABLE public.ticket_modules
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.ticket_issue_types
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.ticket_subject_types
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.sla_rules
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Internal Notes (Whisper Chat) support
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing records into Default Project
DO $$
DECLARE
  v_default_project_id UUID;
BEGIN
  SELECT id INTO v_default_project_id
  FROM public.projects
  WHERE is_default = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_default_project_id IS NOT NULL THEN
    UPDATE public.organizations SET project_id = v_default_project_id WHERE project_id IS NULL;
    UPDATE public.customers SET project_id = v_default_project_id WHERE project_id IS NULL;
    UPDATE public.tickets SET project_id = v_default_project_id WHERE project_id IS NULL;
    UPDATE public.conversations SET project_id = v_default_project_id WHERE project_id IS NULL;

    -- Assign all existing staff members to Default Project so existing workflows never break
    INSERT INTO public.project_members (project_id, profile_id, project_role)
    SELECT v_default_project_id, id, CASE WHEN role = 'Administrator' THEN 'lead' ELSE 'agent' END
    FROM public.profiles
    WHERE role IN ('Agent', 'Administrator')
    ON CONFLICT (project_id, profile_id) DO NOTHING;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. CUSTOMERS COMPOSITE UNIQUE KEY (project_id, line_user_id)
-- Allows the same LINE User ID to register separately across different LINE OAs
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop any existing single-column unique constraint on customers.line_user_id
  FOR r IN
    SELECT conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'customers'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~ '^\s*UNIQUE\s*\(\s*line_user_id\s*\)\s*$'
  LOOP
    EXECUTE format('ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.customers_line_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_project_line_user_unique
  ON public.customers (project_id, line_user_id)
  WHERE line_user_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. DEFAULT project_id FALLBACK TRIGGER (BACKWARD COMPATIBILITY)
-- Ensures any legacy insert omitting project_id is safely scoped to Default Project
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_default_project_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    SELECT id INTO NEW.project_id
    FROM public.projects
    WHERE is_default = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_default_project ON public.organizations;
CREATE TRIGGER trg_organizations_default_project
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_project_id();

DROP TRIGGER IF EXISTS trg_customers_default_project ON public.customers;
CREATE TRIGGER trg_customers_default_project
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_project_id();

DROP TRIGGER IF EXISTS trg_tickets_default_project ON public.tickets;
CREATE TRIGGER trg_tickets_default_project
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_project_id();

DROP TRIGGER IF EXISTS trg_conversations_default_project ON public.conversations;
CREATE TRIGGER trg_conversations_default_project
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_project_id();

-- ------------------------------------------------------------------------------
-- 6. MULTI-PROJECT COMPOSITE & PARTIAL INDEXES
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tickets_project_created_status
  ON public.tickets (project_id, created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_tickets_project_org_status
  ON public.tickets (project_id, organization_id, status);

CREATE INDEX IF NOT EXISTS idx_conversations_project_active_last_msg
  ON public.conversations (project_id, last_message_at DESC NULLS LAST, id DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_organizations_project_name
  ON public.organizations (project_id, name);

CREATE INDEX IF NOT EXISTS idx_messages_ticket_internal_created
  ON public.messages (ticket_id, is_internal, created_at ASC);

-- ------------------------------------------------------------------------------
-- 7. UPDATE claim_ticket_secure RPC (PROPAGATES project_id + VERIFIES ACCESS)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_ticket_secure(p_ticket_id UUID, p_agent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_customer_id UUID;
  v_project_id UUID;
  v_conversation_id UUID;
  v_updated_ticket RECORD;
  v_result JSONB;
BEGIN
  -- 1. Verify agent role
  SELECT role INTO v_role FROM public.profiles WHERE id = p_agent_id;
  IF v_role IS NULL OR NOT (v_role = 'Agent' OR v_role = 'Administrator') THEN
    RAISE EXCEPTION 'Unauthorized: Agent or Administrator role required';
  END IF;

  -- 2. Verify project membership for non-Admin staff
  SELECT project_id INTO v_project_id FROM public.tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  IF v_role <> 'Administrator' AND v_project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = v_project_id AND profile_id = p_agent_id
    ) THEN
      RAISE EXCEPTION 'Forbidden: You do not have access to this project';
    END IF;
  END IF;

  -- 3. Update the ticket
  UPDATE public.tickets
  SET
    assigned_agent_id = p_agent_id,
    status = 'In Progress',
    assigned_at = NOW(),
    updated_at = NOW()
  WHERE id = p_ticket_id
  RETURNING customer_id, project_id INTO v_customer_id, v_project_id;

  -- 4. Select the updated ticket fields
  SELECT * FROM public.tickets WHERE id = p_ticket_id INTO v_updated_ticket;

  -- 5. Check conversation linkage scoped to project
  IF v_customer_id IS NOT NULL THEN
    SELECT id INTO v_conversation_id
    FROM public.conversations
    WHERE current_ticket_id = p_ticket_id AND status = 'active'
    LIMIT 1;

    IF v_conversation_id IS NULL THEN
      SELECT id INTO v_conversation_id
      FROM public.conversations
      WHERE customer_id = v_customer_id
        AND status = 'active'
        AND (v_project_id IS NULL OR project_id = v_project_id)
      ORDER BY last_message_at DESC
      LIMIT 1;

      IF v_conversation_id IS NOT NULL THEN
        UPDATE public.conversations
        SET current_ticket_id = p_ticket_id,
            project_id = COALESCE(project_id, v_project_id),
            last_message_at = NOW()
        WHERE id = v_conversation_id;
      ELSE
        INSERT INTO public.conversations (customer_id, current_ticket_id, project_id, status, last_message_at)
        VALUES (v_customer_id, p_ticket_id, v_project_id, 'active', NOW())
        RETURNING id INTO v_conversation_id;
      END IF;
    END IF;
  END IF;

  -- 6. Insert log
  INSERT INTO public.ticket_logs (ticket_id, action_type, to_status, performer_id, note)
  VALUES (p_ticket_id, 'claim', 'In Progress', p_agent_id, 'Agent claimed the ticket securely via RPC');

  -- 7. Build and return result
  v_result := jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', v_updated_ticket.id,
      'ticket_no', v_updated_ticket.ticket_no,
      'customer_id', v_updated_ticket.customer_id,
      'project_id', v_updated_ticket.project_id,
      'subject', v_updated_ticket.subject,
      'description', v_updated_ticket.description,
      'status', v_updated_ticket.status,
      'assigned_agent_id', v_updated_ticket.assigned_agent_id,
      'module', v_updated_ticket.module,
      'issue_type', v_updated_ticket.issue_type,
      'assigned_at', v_updated_ticket.assigned_at,
      'updated_at', v_updated_ticket.updated_at
    ),
    'conversationId', v_conversation_id
  );

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. UPDATE get_dashboard_summary WITH p_project_ids UUID[] FILTER
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_dashboard_summary(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT, UUID[]);
DROP FUNCTION IF EXISTS public.get_dashboard_summary(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_summary(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_organization_id UUID DEFAULT NULL,
  p_module TEXT DEFAULT NULL,
  p_issue_type TEXT DEFAULT NULL,
  p_project_ids UUID[] DEFAULT NULL
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
      AND (p_project_ids IS NULL OR project_id = ANY(p_project_ids))
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
-- 9. UPDATE get_analytics_dashboard_v2 WITH p_project_ids UUID[] FILTER
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_analytics_dashboard_v2(TEXT, TEXT, UUID[]);
DROP FUNCTION IF EXISTS public.get_analytics_dashboard_v2(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_analytics_dashboard_v2(
  start_date TEXT,
  end_date TEXT,
  p_project_ids UUID[] DEFAULT NULL
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
      id,
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
      AND (p_project_ids IS NULL OR project_id = ANY(p_project_ids))
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
      SELECT ('Score ' || c.score) AS name, COUNT(*) AS value
      FROM public.csat_surveys c
      JOIN filtered f ON c.ticket_id = f.id
      WHERE c.score IS NOT NULL
      GROUP BY c.score
      ORDER BY c.score
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

ANALYZE public.projects;
ANALYZE public.project_members;
ANALYZE public.organizations;
ANALYZE public.customers;
ANALYZE public.tickets;
ANALYZE public.conversations;
ANALYZE public.messages;
