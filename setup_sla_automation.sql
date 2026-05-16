-- =============================================================
-- Migration: SLA Automation & Notification Trigger (FIXED CASTS)
-- =============================================================
-- Description: 
-- 1. Adds a trigger to automatically calculate sla_due_at on ticket creation.
-- 2. Backfills sla_due_at for existing active tickets.
-- =============================================================

BEGIN;

-- 1. Create function to calculate SLA deadline (Added explicit text casting)
CREATE OR REPLACE FUNCTION public.fn_calculate_ticket_sla()
RETURNS TRIGGER AS $$
DECLARE
    v_resolution_mins INTEGER;
BEGIN
    SELECT resolution_time_minutes INTO v_resolution_mins
    FROM public.sla_rules 
    WHERE priority::text = NEW.priority::text 
    LIMIT 1;

    IF v_resolution_mins IS NULL THEN 
        v_resolution_mins := 240; 
    END IF;
    
    NEW.sla_due_at := NEW.created_at + (v_resolution_mins || ' minutes')::interval;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. สร้าง Trigger อัตโนมัติ
DROP TRIGGER IF EXISTS tr_calculate_ticket_sla ON public.tickets;
CREATE TRIGGER tr_calculate_ticket_sla
BEFORE INSERT ON public.tickets 
FOR EACH ROW
EXECUTE FUNCTION public.fn_calculate_ticket_sla();

-- 3. อัปเดตใบงานเก่าที่ยังไม่มี SLA (Added explicit text casting)
UPDATE public.tickets t
SET sla_due_at = t.created_at + (s.resolution_time_minutes || ' minutes')::interval
FROM public.sla_rules s
WHERE t.priority::text = s.priority::text 
  AND t.sla_due_at IS NULL 
  AND t.status::text NOT IN ('Resolved', 'Closed');

COMMIT;
