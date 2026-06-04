-- ==============================================================================
-- Phase 2: Dashboard Performance Indexes
-- ==============================================================================

-- 1. Index for main stats and status filters (Global and Organization level)
CREATE INDEX IF NOT EXISTS idx_tickets_created_org_status
  ON public.tickets (created_at DESC, organization_id, status);

-- 2. Index for advanced filters (Module + Issue Type)
CREATE INDEX IF NOT EXISTS idx_tickets_created_org_module
  ON public.tickets (created_at DESC, organization_id, module, issue_type);

-- 3. Partial index for resolved/closed tickets
CREATE INDEX IF NOT EXISTS idx_tickets_resolved_updated
  ON public.tickets (updated_at DESC, organization_id)
  WHERE status IN ('Resolved', 'Closed');
