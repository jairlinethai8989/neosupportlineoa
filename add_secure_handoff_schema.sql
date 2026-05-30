-- =============================================================
-- Migration: Secure Handoffs and QA Verification Tables
-- =============================================================

BEGIN;

-- 1. Create ticket_handoffs table
CREATE TABLE IF NOT EXISTS public.ticket_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  handoff_type TEXT NOT NULL, -- 'Pending' or 'Escalated'
  token TEXT NOT NULL UNIQUE,  -- unique URL path token
  secure_pin TEXT NOT NULL,    -- 4-digit PIN for access validation
  status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Claimed', 'Completed', 'Rejected', 'Expired'
  target_team TEXT,            -- target external or internal team
  assigned_to_external TEXT,   -- name of external person who claimed
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT handoff_status_check CHECK (status IN ('Active', 'Claimed', 'Completed', 'Rejected', 'Expired')),
  CONSTRAINT handoff_type_check CHECK (handoff_type IN ('Pending', 'Escalated'))
);

-- Indexes for handoffs
CREATE INDEX IF NOT EXISTS idx_ticket_handoffs_token ON public.ticket_handoffs(token);
CREATE INDEX IF NOT EXISTS idx_ticket_handoffs_ticket_id ON public.ticket_handoffs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_handoffs_status ON public.ticket_handoffs(status);

-- Enable RLS for ticket_handoffs
ALTER TABLE public.ticket_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for ticket_handoffs" ON public.ticket_handoffs;
CREATE POLICY "Allow select for ticket_handoffs" ON public.ticket_handoffs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users on ticket_handoffs" ON public.ticket_handoffs;
CREATE POLICY "Allow insert for authenticated users on ticket_handoffs" ON public.ticket_handoffs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for everyone on ticket_handoffs" ON public.ticket_handoffs;
CREATE POLICY "Allow update for everyone on ticket_handoffs" ON public.ticket_handoffs FOR UPDATE USING (true);


-- 2. Create ticket_handoff_reports table
CREATE TABLE IF NOT EXISTS public.ticket_handoff_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id UUID NOT NULL REFERENCES public.ticket_handoffs(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'In Progress', 'Pending', 'Fix Completed'
  reporter_name TEXT NOT NULL,
  notes TEXT NOT NULL,
  attachments TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for reports
CREATE INDEX IF NOT EXISTS idx_handoff_reports_handoff_id ON public.ticket_handoff_reports(handoff_id);

-- Enable RLS for ticket_handoff_reports
ALTER TABLE public.ticket_handoff_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for ticket_handoff_reports" ON public.ticket_handoff_reports;
CREATE POLICY "Allow select for ticket_handoff_reports" ON public.ticket_handoff_reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert for ticket_handoff_reports" ON public.ticket_handoff_reports;
CREATE POLICY "Allow public insert for ticket_handoff_reports" ON public.ticket_handoff_reports FOR INSERT WITH CHECK (true);


-- 3. Create ticket_verifications table
CREATE TABLE IF NOT EXISTS public.ticket_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
  decision TEXT NOT NULL, -- 'Approved', 'Rejected'
  feedback_notes TEXT,
  handoff_id UUID REFERENCES public.ticket_handoffs(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT verification_decision_check CHECK (decision IN ('Approved', 'Rejected'))
);

-- Indexes for verifications
CREATE INDEX IF NOT EXISTS idx_ticket_verifications_ticket_id ON public.ticket_verifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_verifications_handoff_id ON public.ticket_verifications(handoff_id);

-- Enable RLS for ticket_verifications
ALTER TABLE public.ticket_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for ticket_verifications" ON public.ticket_verifications;
CREATE POLICY "Allow select for ticket_verifications" ON public.ticket_verifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users on ticket_verifications" ON public.ticket_verifications;
CREATE POLICY "Allow insert for authenticated users on ticket_verifications" ON public.ticket_verifications FOR INSERT TO authenticated WITH CHECK (true);


-- 4. Backfill existing tokens
INSERT INTO public.ticket_handoffs (ticket_id, handoff_type, token, secure_pin, status, expires_at, created_at, updated_at)
SELECT 
  id as ticket_id,
  CASE WHEN status = 'Pending' THEN 'Pending' ELSE 'Escalated' END as handoff_type,
  escalation_token as token,
  '1234' as secure_pin,
  'Active' as status,
  timezone('utc'::text, now()) + interval '7 days' as expires_at,
  updated_at as created_at,
  updated_at as updated_at
FROM public.tickets
WHERE escalation_token IS NOT NULL AND escalation_token <> ''
ON CONFLICT (token) DO NOTHING;

COMMIT;
