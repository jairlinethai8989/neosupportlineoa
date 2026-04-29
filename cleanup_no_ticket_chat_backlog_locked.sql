-- cleanup_no_ticket_chat_backlog_locked.sql
-- Purpose:
--   Safe cleanup for specific records only (locked scope).
--   You must explicitly list target customer_id/conversation_id.
--
-- How to use:
--   1) Fill target IDs in target_customers / target_conversations CTE.
--   2) Run in preview mode first (v_apply_delete = false).
--   3) Verify preview result.
--   4) Set v_apply_delete = true and run again to delete.

BEGIN;

-- ============================================================
-- 0) TARGET LOCK (REQUIRED)
-- ============================================================
-- Put only IDs you explicitly approve.
WITH
target_customers AS (
  -- Example:
  -- SELECT '11111111-1111-1111-1111-111111111111'::uuid AS customer_id
  SELECT NULL::uuid AS customer_id WHERE false
),
target_conversations AS (
  -- Example:
  -- SELECT '22222222-2222-2222-2222-222222222222'::uuid AS conversation_id
  SELECT NULL::uuid AS conversation_id WHERE false
)
SELECT
  (SELECT COUNT(*) FROM target_customers) AS target_customer_count,
  (SELECT COUNT(*) FROM target_conversations) AS target_conversation_count;

-- ============================================================
-- 1) Build locked candidate set
--   Criteria:
--   - in explicit target scope only
--   - current_ticket_id IS NULL
--   - has customer LINE message (line_message_id is not null)
-- ============================================================
DROP TABLE IF EXISTS tmp_no_ticket_locked_candidates;
CREATE TEMP TABLE tmp_no_ticket_locked_candidates AS
WITH
target_customers AS (
  SELECT NULL::uuid AS customer_id WHERE false
),
target_conversations AS (
  SELECT NULL::uuid AS conversation_id WHERE false
),
scope_conversations AS (
  SELECT c.id AS conversation_id
  FROM public.conversations c
  WHERE (
    c.customer_id IN (SELECT customer_id FROM target_customers)
    OR c.id IN (SELECT conversation_id FROM target_conversations)
  )
)
SELECT DISTINCT c.id AS conversation_id
FROM public.conversations c
JOIN scope_conversations sc
  ON sc.conversation_id = c.id
JOIN public.messages m
  ON m.conversation_id = c.id
WHERE c.current_ticket_id IS NULL
  AND m.sender_type = 'customer'
  AND m.line_message_id IS NOT NULL;

-- Hard guard: if no explicit scope, candidate must be empty.
-- (Prevents accidental broad delete when target list is not filled.)
SELECT
  COUNT(*) AS locked_candidate_count
FROM tmp_no_ticket_locked_candidates;

-- ============================================================
-- 2) Preview summary
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM tmp_no_ticket_locked_candidates) AS conversation_count,
  (
    SELECT COUNT(*)
    FROM public.messages m
    JOIN tmp_no_ticket_locked_candidates t
      ON t.conversation_id = m.conversation_id
  ) AS message_count;

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
JOIN tmp_no_ticket_locked_candidates t
  ON t.conversation_id = c.id
LEFT JOIN public.messages m
  ON m.conversation_id = c.id
GROUP BY c.id, c.customer_id, c.status, c.created_at, c.last_message_at
ORDER BY last_message_at_msg DESC NULLS LAST;

SELECT
  m.id,
  m.conversation_id,
  m.sender_type,
  m.message_type,
  m.content,
  m.line_message_id,
  m.created_at
FROM public.messages m
JOIN tmp_no_ticket_locked_candidates t
  ON t.conversation_id = m.conversation_id
ORDER BY m.created_at DESC
LIMIT 200;

-- ============================================================
-- 3) Delete phase (guarded)
-- ============================================================
DO $$
DECLARE
  v_apply_delete boolean := false; -- <<< set true to execute delete
  v_candidate_count integer := 0;
  v_deleted_messages integer := 0;
  v_deleted_conversations integer := 0;
BEGIN
  SELECT COUNT(*) INTO v_candidate_count FROM tmp_no_ticket_locked_candidates;

  IF v_candidate_count = 0 THEN
    RAISE NOTICE 'No locked candidates found. Nothing to delete.';
    RETURN;
  END IF;

  IF NOT v_apply_delete THEN
    RAISE NOTICE 'Preview mode only. No data deleted. Set v_apply_delete=true in DO block to execute.';
    RETURN;
  END IF;

  DELETE FROM public.messages m
  USING tmp_no_ticket_locked_candidates t
  WHERE m.conversation_id = t.conversation_id;
  GET DIAGNOSTICS v_deleted_messages = ROW_COUNT;

  DELETE FROM public.conversations c
  USING tmp_no_ticket_locked_candidates t
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

