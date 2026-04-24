-- Fix CSAT Survey Permissions to allow public submissions
-- Run this in Supabase SQL Editor

-- 1. Allow public to INSERT into csat_surveys
DROP POLICY IF EXISTS "Allow public insert on csat_surveys" ON public.csat_surveys;
CREATE POLICY "Allow public insert on csat_surveys"
ON public.csat_surveys FOR INSERT
WITH CHECK (true);

-- 2. Ensure public can UPDATE (already exists but re-confirming)
DROP POLICY IF EXISTS "Allow public update on csat_surveys" ON public.csat_surveys;
CREATE POLICY "Allow public update on csat_surveys"
ON public.csat_surveys FOR UPDATE
USING (true)
WITH CHECK (true);

-- 3. Ensure public can SELECT (to check if already responded)
DROP POLICY IF EXISTS "Allow public select on csat_surveys" ON public.csat_surveys;
CREATE POLICY "Allow public select on csat_surveys"
ON public.csat_surveys FOR SELECT
USING (true);
