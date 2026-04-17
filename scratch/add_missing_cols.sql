-- Add missing settings columns
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS resolution_templates TEXT[] DEFAULT ARRAY['ดำเนินการแก้ไขเรียบร้อยแล้วครับ', 'ส่งมอบงานประสานงานสำเร็จ', 'ยกเลิกเนื่องจากแจ้งผิดพลาด'],
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"start": "08:30", "end": "17:30", "days": [1, 2, 3, 4, 5]}'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN public.company_settings.business_hours IS 'Business hours for SLA calculation. Days: 0=Sun, 1=Mon...';
