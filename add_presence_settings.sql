-- =============================================================
-- Presence & Active Status Tracking Settings Migration
-- =============================================================
-- Description:
--   1. Adds 'last_seen' column to public.profiles for activity heartbeat.
--   2. Adds 'active_threshold_minutes' to public.company_settings for Admin configuration.
-- =============================================================

-- 1. Add last_seen column to track staff heartbeat
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Add active_threshold_minutes column for global admin active timeout configuration (default 15 minutes)
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS active_threshold_minutes INTEGER NOT NULL DEFAULT 15;
