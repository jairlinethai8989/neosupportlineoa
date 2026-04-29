-- cleanup_no_ticket_chat_backlog.sql
-- Purpose:
--   Safely clean up legacy LINE OA chat backlog that was ingested without ticket flow.
-- Safety:
--   1) Run as-is first (apply_delete = false) to preview.
--   2) Verify result set.
--   3) Set apply_delete = true and run again to execute deletion.

BEGIN;

-- ============================================================
-- 0) Config
-- ============================================================
-- IMPORTANT: keep false for preview mode.
WITH cfg AS (
  SELECT
    false::boolean AS apply_delete
)
SELECT apply_delete AS preview_mode_is_delete
FROM cfg;

-- ============================================================
-- 1) Build candidate set (No Ticket conversations)
--   Criteria:
--   - conversation.current_ticket_id IS NULL
--   - has at least one customer message from LINE (line_message_id not null)
-- ============================================================
DROP TABLE IF EXISTS tmp_no_ticket_conversation_candidates;
CREATE TEMP TABLE tmp_no_ticket_conversation_candidates AS
SELECT DISTINCT c.id AS conversation_id
FROM public.conversations c
JOIN public.messages m ON m.conversation_id = c.id
WHERE c.current_ticket_id IS NULL
  AND m.sender_type = 'customer'
  AND m.line_message_id IS NOT NULL;

-- ============================================================
-- 2) Preview summary
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM tmp_no_ticket_conversation_candidates) AS conversation_count,
  (
    SELECT COUNT(*)
    FROM public.messages m
    JOIN tmp_no_ticket_conversation_candidates t
      ON t.conversation_id = m.conversation_id
  ) AS message_count;

-- Preview by conversation/customer
SELECT
  c.id AS conversation_id,
  c.customer_id,
  c.status,
  c.created_at AS conversation_created_at,
  c.last_message_at,
  COUNT(m.id) AS message_count,
  MIN(m.created_at) AS first_message_at,
  MAX(m.created_at) AS last_message_at_msg
FROM public.conversations c
JOIN tmp_no_ticket_conversation_candidates t
  ON t.conversation_id = c.id
LEFT JOIN public.messages m
  ON m.conversation_id = c.id
GROUP BY c.id, c.customer_id, c.status, c.created_at, c.last_message_at
ORDER BY last_message_at_msg DESC NULLS LAST
LIMIT 200;

-- ============================================================
-- 3) Preview sample messages
-- ============================================================
SELECT
  m.id,
  m.conversation_id,
  m.sender_type,
  m.message_type,
  m.content,
  m.line_message_id,
  m.created_at
FROM public.messages m
JOIN tmp_no_ticket_conversation_candidates t
  ON t.conversation_id = m.conversation_id
ORDER BY m.created_at DESC
LIMIT 200;

-- ============================================================
-- 4) Delete phase (guarded by apply_delete)
-- ============================================================
DO $$
DECLARE
  v_apply_delete boolean := false; -- <<< set true to execute delete
  v_deleted_messages integer := 0;
  v_deleted_conversations integer := 0;
BEGIN
  IF NOT v_apply_delete THEN
    RAISE NOTICE 'Preview mode only. No data deleted. Set v_apply_delete=true in DO block to execute.';
    RETURN;
  END IF;

  DELETE FROM public.messages m
  USING tmp_no_ticket_conversation_candidates t
  WHERE m.conversation_id = t.conversation_id;
  GET DIAGNOSTICS v_deleted_messages = ROW_COUNT;

  DELETE FROM public.conversations c
  USING tmp_no_ticket_conversation_candidates t
  WHERE c.id = t.conversation_id
    AND c.current_ticket_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.messages m2
      WHERE m2.conversation_id = c.id
    );
  GET DIAGNOSTICS v_deleted_conversations = ROW_COUNT;

  RAISE NOTICE 'Deleted messages: %, deleted conversations: %', v_deleted_messages, v_deleted_conversations;
END $$;

COMMIT;

