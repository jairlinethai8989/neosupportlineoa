-- Backfill script to snapshot hospital_id and department_id from customers to existing tickets
UPDATE tickets t
SET 
  hospital_id = c.hospital_id,
  current_department_id = c.department_id
FROM customers c
WHERE t.customer_id = c.id
AND (t.hospital_id IS NULL OR t.current_department_id IS NULL);
