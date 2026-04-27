-- =============================================================
-- Optimization Index Pack (Chat + Reports)
-- Run during a low-traffic window.
-- =============================================================

BEGIN;

-- Cursor/infinite-scroll style message fetch:
-- where conversation_id = ? order by created_at desc limit ?
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at_desc
  ON public.messages (conversation_id, created_at DESC);

-- Latest ticket per conversation:
-- where conversation_id = ? and ticket_id is not null order by created_at desc limit 1
CREATE INDEX IF NOT EXISTS idx_messages_conversation_ticket_created_at_desc
  ON public.messages (conversation_id, ticket_id, created_at DESC)
  WHERE ticket_id IS NOT NULL;

-- Ticket timeline/log feed:
-- where ticket_id = ? order by created_at desc
CREATE INDEX IF NOT EXISTS idx_ticket_logs_ticket_created_at_desc
  ON public.ticket_logs (ticket_id, created_at DESC);

-- Conversation list page:
-- active-like chats sorted by last activity
CREATE INDEX IF NOT EXISTS idx_conversations_active_last_message_at_desc
  ON public.conversations (last_message_at DESC)
  WHERE status = 'active';

-- Fast lookup when validating ticket-conversation relation
CREATE INDEX IF NOT EXISTS idx_conversations_ticket_status
  ON public.conversations (current_ticket_id, status)
  WHERE current_ticket_id IS NOT NULL;

-- Common ticket board/report filters and sorts
CREATE INDEX IF NOT EXISTS idx_tickets_status_created_at_desc
  ON public.tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_status_resolved_at_desc
  ON public.tickets (status, resolved_at DESC);

COMMIT;
