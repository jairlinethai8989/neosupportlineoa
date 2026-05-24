-- SQL Migration: Create staff_evaluations table
CREATE TABLE IF NOT EXISTS public.staff_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  kpi_stats JSONB NOT NULL,
  evaluation_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  CONSTRAINT staff_evaluations_period_unique UNIQUE (agent_id, start_date, end_date)
);

-- Enable RLS
ALTER TABLE public.staff_evaluations ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Enable read for authenticated users" ON public.staff_evaluations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable all actions for supervisors and admins" ON public.staff_evaluations
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.role = 'Administrator' OR profiles.permissions->>'analytics_staff' IN ('view', 'edit'))
    )
  );
