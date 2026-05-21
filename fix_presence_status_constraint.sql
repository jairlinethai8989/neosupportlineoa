-- =============================================================
-- Presence & Active Status 'Busy' Constraint Update
-- =============================================================
-- Description:
--   Alters the profiles table constraint to support the new 'Busy' status.
-- =============================================================

-- 1. Drop the existing status check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

-- 2. Add the updated check constraint that includes 'Busy'
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('Active', 'Away', 'Offline', 'Busy'));
