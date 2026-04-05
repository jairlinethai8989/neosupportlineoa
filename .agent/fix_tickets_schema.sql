-- 1. Ensure 'tickets' table has 'customer_id' and correct structure
DO $$ 
BEGIN 
    -- Check if tickets table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
        
        -- Add customer_id if missing
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'customer_id') THEN
            ALTER TABLE public.tickets ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
        END IF;

        -- Add ticket_no if missing
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'ticket_no') THEN
            ALTER TABLE public.tickets ADD COLUMN ticket_no TEXT;
        END IF;

        -- Add subject if missing
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'subject') THEN
            ALTER TABLE public.tickets ADD COLUMN subject TEXT;
        END IF;

    END IF;
END $$;

-- 2. Force refresh schema cache by performing a minor DDL
-- This is a trick to make PostgREST aware of new columns
COMMENT ON TABLE public.tickets IS 'System support tickets';

-- 3. Release permissions
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert on tickets" ON public.tickets;
CREATE POLICY "Allow public insert on tickets" ON public.tickets FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read on tickets" ON public.tickets;
CREATE POLICY "Allow public read on tickets" ON public.tickets FOR SELECT USING (true);
