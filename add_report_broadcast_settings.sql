-- Report hub broadcast settings (manual/auto + target group + multi schedule rows)
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS report_broadcast_mode text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS report_broadcast_group_id text,
  ADD COLUMN IF NOT EXISTS report_broadcast_schedules jsonb DEFAULT '[]'::jsonb;

-- Normalize existing rows
UPDATE public.company_settings
SET report_broadcast_mode = COALESCE(report_broadcast_mode, 'manual'),
    report_broadcast_schedules = COALESCE(report_broadcast_schedules, '[]'::jsonb);

-- Optional check constraint for mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_company_settings_report_broadcast_mode'
  ) THEN
    ALTER TABLE public.company_settings
      ADD CONSTRAINT chk_company_settings_report_broadcast_mode
      CHECK (report_broadcast_mode IN ('manual', 'auto'));
  END IF;
END $$;
