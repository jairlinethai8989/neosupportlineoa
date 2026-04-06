-- Fix Missing Columns in Tickets Table
-- This script adds the columns needed for the Resolve functionality.

DO $$ 
BEGIN 
    -- Check if tickets table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
        
        -- Add resolved_at if missing
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'resolved_at') THEN
            ALTER TABLE public.tickets ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE;
        END IF;

        -- Add assigned_at if missing
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'assigned_at') THEN
            ALTER TABLE public.tickets ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE;
        END IF;

        -- Add resolution_summary if missing
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'resolution_summary') THEN
            ALTER TABLE public.tickets ADD COLUMN resolution_summary TEXT;
        END IF;

        -- Force refresh schema cache
        COMMENT ON TABLE public.tickets IS 'System support tickets v1.1';
    END IF;
END $$;
