-- =============================================================
-- Guard: 1 active ticket mapping to 1 conversation
-- =============================================================
-- Goal:
--   Prevent one ticket from being linked to multiple active conversations.
--   This supports the rule "1 ticket : 1 chat" even for the same customer.
--
-- Notes:
--   - This migration intentionally removes the old per-customer active unique index
--     (if present), because the product now supports multiple active tickets/chats
--     for the same customer.
--   - A pre-check is included to fail fast if legacy duplicate mappings exist.
-- =============================================================

BEGIN;

DO $$
DECLARE
  duplicate_row RECORD;
BEGIN
  SELECT
    current_ticket_id,
    COUNT(*) AS duplicate_count
  INTO duplicate_row
  FROM public.conversations
  WHERE status = 'active'
    AND current_ticket_id IS NOT NULL
  GROUP BY current_ticket_id
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_row.current_ticket_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Duplicate active conversations detected for ticket_id=% (count=%). Clean data first, then rerun migration.',
      duplicate_row.current_ticket_id,
      duplicate_row.duplicate_count;
  END IF;
END
$$;

DROP INDEX IF EXISTS public.uq_conversations_active_customer;

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_active_ticket
  ON public.conversations(current_ticket_id)
  WHERE status = 'active' AND current_ticket_id IS NOT NULL;

COMMIT;
