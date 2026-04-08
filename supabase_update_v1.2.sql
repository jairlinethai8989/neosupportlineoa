-- Database Architecture Optimization Script v1.2
-- 1. Standardize Ticket Statuses (Fix Case Sensitivity)
-- 2. Complete Teams Relationship & Organization

BEGIN;

-- Part A: Data Normalization
-- Convert any 'new' statuses to 'New' to fix dashboard counters
UPDATE public.tickets 
SET status = 'New' 
WHERE status = 'new';

-- Standardize other possible variations
UPDATE public.tickets SET status = 'In Progress' WHERE status ILIKE 'in progress';
UPDATE public.tickets SET status = 'Resolved' WHERE status ILIKE 'resolved';
UPDATE public.tickets SET status = 'Escalated' WHERE status ILIKE 'escalated';

-- Part B: Structure Enhancement (Teams)
-- Check if teams table exists (it was likely created manually)
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    manager_id UUID REFERENCES auth.users(id),
    color_code TEXT DEFAULT '#00f2fe',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add team_id to profiles if missing to link agents to teams
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'team_id') THEN
        ALTER TABLE public.profiles ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Part C: Performance Optimization
-- Create index for status counts (used in Sidebar)
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);

-- Part D: Table Metadata for clarity
COMMENT ON TABLE public.teams IS 'Support teams for agent organization';
COMMENT ON COLUMN public.profiles.team_id IS 'Link to the primary team this staff member belongs to';

COMMIT;
