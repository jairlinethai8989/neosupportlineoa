-- Index Regression Check
-- Purpose: Verify that critical queries are using the newly created indexes.

-- 1. Messages in conversation
EXPLAIN ANALYZE
SELECT * FROM public.messages 
WHERE conversation_id = '00000000-0000-0000-0000-000000000000' -- Dummy UUID
ORDER BY created_at DESC 
LIMIT 50;

-- 2. Latest ticket message
EXPLAIN ANALYZE
SELECT * FROM public.messages 
WHERE conversation_id = '00000000-0000-0000-0000-000000000000' 
  AND ticket_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 1;

-- 3. Ticket logs
EXPLAIN ANALYZE
SELECT * FROM public.ticket_logs 
WHERE ticket_id = '00000000-0000-0000-0000-000000000000' 
ORDER BY created_at DESC;

-- 4. Active conversations list
EXPLAIN ANALYZE
SELECT * FROM public.conversations 
WHERE status = 'active' 
ORDER BY last_message_at DESC 
LIMIT 20;

-- 5. Ticket board (New/Open)
EXPLAIN ANALYZE
SELECT * FROM public.tickets 
WHERE status IN ('New', 'Assigned', 'In Progress') 
ORDER BY created_at DESC 
LIMIT 100;

-- 6. Resolved reports
EXPLAIN ANALYZE
SELECT * FROM public.tickets 
WHERE status IN ('Resolved', 'Closed') 
ORDER BY resolved_at DESC 
LIMIT 100;
