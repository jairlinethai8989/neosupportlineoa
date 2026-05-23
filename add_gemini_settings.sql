-- =============================================================
-- Gemini AI API Key Settings Migration
-- =============================================================
-- Description:
--   1. Adds 'gemini_api_key' column to public.company_settings for Admin configuration.
-- =============================================================

ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
