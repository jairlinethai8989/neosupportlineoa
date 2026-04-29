-- =============================================================
-- Migration: Add Missing SLA Columns
-- =============================================================
-- Description: Adds the `sla_due_at` column to the `tickets` table
-- to enable SLA monitoring and notifications.
-- =============================================================

BEGIN;

-- 1. Add sla_due_at column
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMP WITH TIME ZONE;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_tickets_sla_due_at ON public.tickets(sla_due_at);

-- 3. Comment for documentation
COMMENT ON COLUMN public.tickets.sla_due_at IS 'The calculated deadline for this ticket based on SLA rules.';

COMMIT;
