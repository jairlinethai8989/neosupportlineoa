-- SQL Migration: Create 360-degree performance evaluation table
CREATE TABLE IF NOT EXISTS public.staff_evaluations_360 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  evaluator_role VARCHAR(50) NOT NULL CHECK (evaluator_role IN ('lead', 'peer', 'user', 'self')),
  evaluation_period VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Scores (1 to 5 scale frequency rating)
  system_data_expertise INT CHECK (system_data_expertise >= 1 AND system_data_expertise <= 5),
  troubleshooting_sla INT CHECK (troubleshooting_sla >= 1 AND troubleshooting_sla <= 5),
  shift_availability INT CHECK (shift_availability >= 1 AND shift_availability <= 5),
  handover_quality INT CHECK (handover_quality >= 1 AND handover_quality <= 5),
  knowledge_sharing INT CHECK (knowledge_sharing >= 1 AND knowledge_sharing <= 5),
  crisis_communication INT CHECK (crisis_communication >= 1 AND crisis_communication <= 5),
  emotional_regulation INT CHECK (emotional_regulation >= 1 AND emotional_regulation <= 5),
  learning_agility INT CHECK (learning_agility >= 1 AND learning_agility <= 5),
  
  comments TEXT,
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  
  -- Prevent multiple evaluations of the same agent by the same evaluator for the same period and role
  CONSTRAINT staff_evaluations_360_unique_eval UNIQUE (agent_id, evaluator_id, evaluation_period, evaluator_role)
);

-- Enable Row Level Security
ALTER TABLE public.staff_evaluations_360 ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Enable select access for authenticated users" ON public.staff_evaluations_360
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable write access for creators and supervisors" ON public.staff_evaluations_360
  FOR ALL TO authenticated USING (
    auth.uid() = evaluator_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.role = 'Administrator' OR profiles.permissions->>'analytics_staff' = 'edit')
    )
  );
