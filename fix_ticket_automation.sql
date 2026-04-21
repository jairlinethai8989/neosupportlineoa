-- =============================================================
-- NeoSupport Ticket Numbering Automation & Hospital Selection Support
-- =============================================================

BEGIN;

-- 1. Create Sequence for Ticket Numbering (if not exists)
CREATE SEQUENCE IF NOT EXISTS public.ticket_no_seq;

-- 2. Create optimized function to generate ticket numbers
-- Format: TIC-YYYYMMDD-XXXX (e.g. TIC-20240421-0001)
CREATE OR REPLACE FUNCTION public.fn_generate_ticket_no()
RETURNS TRIGGER AS $$
DECLARE
    date_part TEXT;
    seq_part TEXT;
BEGIN
    date_part := to_char(CURRENT_DATE, 'YYYYMMDD');
    seq_part := lpad(nextval('public.ticket_no_seq')::text, 4, '0');
    
    NEW.ticket_no := 'TIC-' || date_part || '-' || seq_part;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach Trigger to tickets table
DROP TRIGGER IF EXISTS tr_generate_ticket_no ON public.tickets;
CREATE TRIGGER tr_generate_ticket_no
BEFORE INSERT ON public.tickets
FOR EACH ROW
WHEN (NEW.ticket_no IS NULL)
EXECUTE FUNCTION public.fn_generate_ticket_no();

-- 4. Ensure we have a default "System Customer" for Internal Tickets
-- Since tickets require a customer_id, we need a placeholder if we only select a hospital.
-- Or better: If they select a hospital, we assign the ticket to the hospital and maybe pick the first customer of that hospital?
-- For now, let's allow hospital_id but keeping customer_id as mandatory. 
-- We will adjust the frontend to pick the "placeholder" customer for the selected hospital.

COMMIT;
