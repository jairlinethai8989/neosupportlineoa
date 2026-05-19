-- Phase 3: Normalize Company Settings Arrays into Relational Tables
-- Goal: Extract 'modules', 'issue_types', and 'subject_types' from company_settings into dedicated tables.

-- 1. Create the new tables
CREATE TABLE IF NOT EXISTS public.ticket_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ticket_issue_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ticket_subject_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Migrate existing data from JSONB arrays
-- Handle modules
INSERT INTO public.ticket_modules (name)
SELECT DISTINCT unnest(modules) 
FROM public.company_settings 
WHERE modules IS NOT NULL AND array_length(modules, 1) > 0
ON CONFLICT (name) DO NOTHING;

-- Handle issue_types
INSERT INTO public.ticket_issue_types (name)
SELECT DISTINCT unnest(issue_types) 
FROM public.company_settings 
WHERE issue_types IS NOT NULL AND array_length(issue_types, 1) > 0
ON CONFLICT (name) DO NOTHING;

-- Handle subject_types
INSERT INTO public.ticket_subject_types (name)
SELECT DISTINCT unnest(subject_types) 
FROM public.company_settings 
WHERE subject_types IS NOT NULL AND array_length(subject_types, 1) > 0
ON CONFLICT (name) DO NOTHING;

-- 3. Set up RLS Policies for the new tables
ALTER TABLE public.ticket_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_issue_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_subject_types ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to ticket_modules" ON public.ticket_modules FOR SELECT USING (true);
CREATE POLICY "Allow read access to ticket_issue_types" ON public.ticket_issue_types FOR SELECT USING (true);
CREATE POLICY "Allow read access to ticket_subject_types" ON public.ticket_subject_types FOR SELECT USING (true);

-- Allow Admins to insert, update, delete
CREATE POLICY "Admins can manage ticket_modules" ON public.ticket_modules FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Administrator')
);
CREATE POLICY "Admins can manage ticket_issue_types" ON public.ticket_issue_types FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Administrator')
);
CREATE POLICY "Admins can manage ticket_subject_types" ON public.ticket_subject_types FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Administrator')
);

-- 4. Clean up the old columns from company_settings
ALTER TABLE public.company_settings 
DROP COLUMN IF EXISTS modules,
DROP COLUMN IF EXISTS issue_types,
DROP COLUMN IF EXISTS subject_types;

-- End of Phase 3 Migration
