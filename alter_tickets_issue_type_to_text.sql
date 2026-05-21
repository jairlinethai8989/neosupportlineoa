-- Safe migration to convert tickets.issue_type to TEXT
-- This allows dynamic Thai issue types configured from the master settings panel.

DO $$ 
BEGIN 
    -- Check if tickets table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
        -- Alter column type to TEXT
        ALTER TABLE public.tickets ALTER COLUMN issue_type TYPE TEXT;
        
        -- Force refresh schema cache by updating the table comment
        COMMENT ON TABLE public.tickets IS 'System support tickets v1.1.2';
    END IF;
END $$;
