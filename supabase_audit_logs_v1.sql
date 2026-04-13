-- =============================================================
-- NeoSupport Audit Logging System - Migration v1.0
-- Tables: ticket_logs, system_logs
-- Triggers: auto_log_ticket_status (on tickets UPDATE)
-- =============================================================

BEGIN;

-- ============================================================
-- TABLE 1: ticket_logs
-- Stores all ticket-level actions: claim, transfer, resolve, status_change
-- Called directly by ticketService.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ticket_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  performer_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type     TEXT NOT NULL,           -- 'claim' | 'transfer' | 'resolve' | 'status_change'
  from_status     TEXT,
  to_status       TEXT,
  to_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_team_id      UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 2: system_logs
-- Stores high-level admin/system events: staff_create, branding_update, login, etc.
-- Called via auditService.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performer_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type     TEXT NOT NULL,           -- 'staff_create' | 'branding_update' | 'dept_create' | 'login' | etc.
  entity_type     TEXT,                    -- 'ticket' | 'staff' | 'company' | 'sla' | etc.
  entity_id       TEXT,                    -- ID of the entity affected
  old_data        JSONB,
  new_data        JSONB,
  note            TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance (Sidebar & Audit page queries)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ticket_logs_ticket_id    ON public.ticket_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_performer_id ON public.ticket_logs(performer_id);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_created_at   ON public.ticket_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_action_type  ON public.ticket_logs(action_type);

CREATE INDEX IF NOT EXISTS idx_system_logs_performer_id ON public.system_logs(performer_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at   ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_action_type  ON public.system_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_entity_type  ON public.system_logs(entity_type);

-- ============================================================
-- ROW LEVEL SECURITY
-- Only authenticated agents can SELECT; INSERT is open to service role
-- ============================================================
ALTER TABLE public.ticket_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DROP POLICY IF EXISTS "Agents can view ticket logs"  ON public.ticket_logs;
DROP POLICY IF EXISTS "Service can insert ticket logs" ON public.ticket_logs;
DROP POLICY IF EXISTS "Agents can view system logs"  ON public.system_logs;
DROP POLICY IF EXISTS "Service can insert system logs" ON public.system_logs;

-- ticket_logs: Any logged-in user can read, authenticated can insert
CREATE POLICY "Agents can view ticket logs"
  ON public.ticket_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service can insert ticket logs"
  ON public.ticket_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- system_logs: Same pattern
CREATE POLICY "Agents can view system logs"
  ON public.system_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service can insert system logs"
  ON public.system_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- AUTO-TRIGGER: Log ticket status changes automatically
-- This is a safety net — ticketService.ts also logs manually.
-- The trigger avoids duplicate logging using a session variable.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_auto_log_ticket_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skip BOOLEAN;
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Check session variable: ticketService sets this before its own INSERT
    -- to prevent duplicate logs. Default = false (trigger logs).
    BEGIN
      v_skip := current_setting('app.skip_audit_trigger', true)::BOOLEAN;
    EXCEPTION WHEN OTHERS THEN
      v_skip := FALSE;
    END;

    IF NOT v_skip THEN
      INSERT INTO public.ticket_logs (
        ticket_id,
        performer_id,
        action_type,
        from_status,
        to_status,
        note
      ) VALUES (
        NEW.id,
        NEW.assigned_agent_id,
        'status_change',
        OLD.status,
        NEW.status,
        '[trigger] Status changed (direct DB update, not via app service)'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to tickets table (fires AFTER UPDATE)
DROP TRIGGER IF EXISTS trg_auto_log_ticket_status ON public.tickets;
CREATE TRIGGER trg_auto_log_ticket_status
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_log_ticket_status();

-- ============================================================
-- HELPER VIEW: audit_timeline
-- Unified view combining ticket_logs + system_logs for timeline display
-- ============================================================
CREATE OR REPLACE VIEW public.audit_timeline AS
  SELECT
    id,
    'ticket'      AS log_source,
    ticket_id     AS entity_id,
    performer_id,
    action_type,
    note,
    created_at
  FROM public.ticket_logs
  UNION ALL
  SELECT
    id,
    'system'      AS log_source,
    entity_id::UUID AS entity_id,
    performer_id,
    action_type,
    note,
    created_at
  FROM public.system_logs
  WHERE entity_id IS NOT NULL AND entity_id ~ '^[0-9a-f-]{36}$';

-- ============================================================
-- TABLE COMMENTS
-- ============================================================
COMMENT ON TABLE public.ticket_logs  IS 'Audit trail for all ticket-level actions (claim, transfer, resolve, status changes). v1.0';
COMMENT ON TABLE public.system_logs  IS 'Audit trail for system-level admin events (staff management, branding, settings). v1.0';
COMMENT ON VIEW  public.audit_timeline IS 'Unified timeline combining ticket_logs and system_logs for the Audit Log Dashboard.';

COMMIT;
