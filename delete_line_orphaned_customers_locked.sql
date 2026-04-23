-- Locked cleanup script for 5 legacy LINE users that return 404 from LINE profile API
-- Scope is intentionally fixed to exactly these 5 customer IDs.
-- Run inside SQL editor and review preview rows before executing DELETE blocks.

BEGIN;

WITH locked_ids AS (
  SELECT UNNEST(ARRAY[
    '61a8bb18-a197-4b77-b167-0f034aeed963'::uuid,
    '13633a48-33fb-47ec-aec4-7ab60b67efb8'::uuid,
    '3b1f426c-3ee8-4756-85e6-14448f2abff8'::uuid,
    'e1deffbe-d691-4096-aa39-329b1f3f226b'::uuid,
    '3d04f63f-a34b-4482-9947-741a36f5138b'::uuid
  ]) AS id
)
SELECT c.id, c.line_user_id, c.display_name
FROM public.customers c
JOIN locked_ids l ON l.id = c.id
ORDER BY c.id;

-- Optional safety preview
WITH locked_ids AS (
  SELECT UNNEST(ARRAY[
    '61a8bb18-a197-4b77-b167-0f034aeed963'::uuid,
    '13633a48-33fb-47ec-aec4-7ab60b67efb8'::uuid,
    '3b1f426c-3ee8-4756-85e6-14448f2abff8'::uuid,
    'e1deffbe-d691-4096-aa39-329b1f3f226b'::uuid,
    '3d04f63f-a34b-4482-9947-741a36f5138b'::uuid
  ]) AS id
)
SELECT
  c.id,
  (SELECT COUNT(*) FROM public.tickets t WHERE t.customer_id = c.id) AS ticket_count,
  (SELECT COUNT(*) FROM public.conversations conv WHERE conv.customer_id = c.id) AS conversation_count,
  (SELECT COUNT(*) FROM public.messages m WHERE m.customer_id = c.id) AS message_count
FROM public.customers c
JOIN locked_ids l ON l.id = c.id
ORDER BY c.id;

-- Execute deletion for locked IDs only
WITH locked_ids AS (
  SELECT UNNEST(ARRAY[
    '61a8bb18-a197-4b77-b167-0f034aeed963'::uuid,
    '13633a48-33fb-47ec-aec4-7ab60b67efb8'::uuid,
    '3b1f426c-3ee8-4756-85e6-14448f2abff8'::uuid,
    'e1deffbe-d691-4096-aa39-329b1f3f226b'::uuid,
    '3d04f63f-a34b-4482-9947-741a36f5138b'::uuid
  ]) AS id
)
DELETE FROM public.customers c
USING locked_ids l
WHERE c.id = l.id;

COMMIT;
