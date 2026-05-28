-- =============================================================
-- Profile Settings Auto Logout Column Migration
-- =============================================================
-- Description:
--   Adds 'auto_logout_minutes' column to public.profiles for individual timeout configuration.
-- =============================================================

-- Add auto_logout_minutes column to profiles (default 0, which means Never/Disabled)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_logout_minutes INTEGER NOT NULL DEFAULT 0;
