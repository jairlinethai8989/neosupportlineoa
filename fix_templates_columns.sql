-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Add columns to profiles table for personal templates
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS quick_replies JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS resolution_templates JSONB DEFAULT '[]'::jsonb;

-- 2. Add column to company_settings table for global templates
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS resolution_templates JSONB DEFAULT '[]'::jsonb;

-- Verify results
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('quick_replies', 'resolution_templates');
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'resolution_templates';
