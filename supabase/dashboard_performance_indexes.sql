-- ==============================================================================
-- Phase 2: Dashboard Performance Indexes
-- ==============================================================================
-- Instructions: Please run this script in your Supabase SQL Editor.
-- These indexes are designed to optimize the `get_dashboard_summary` RPC
-- by preventing full table scans on the `tickets` table.

-- 1. Index for main stats and status filters (Global and Organization level)
-- Helps with filtering by date range and grouping by status quickly.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_created_org_status
  ON public.tickets (created_at DESC, organization_id, status);

-- 2. Index for advanced filters (Module + Issue Type)
-- Helps when users drill down using the dropdown filters.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_created_org_module
  ON public.tickets (created_at DESC, organization_id, module, issue_type);

-- 3. Partial index for resolved/closed tickets
-- Specifically targets the `resolvedCountsByDay` query which checks `updated_at`.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_resolved_updated
  ON public.tickets (updated_at DESC, organization_id)
  WHERE status IN ('Resolved', 'Closed');
