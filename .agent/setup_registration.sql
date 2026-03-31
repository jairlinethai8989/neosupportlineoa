-- 1. Create Hospitals Master Data Table
CREATE TABLE IF NOT EXISTS public.hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Departments Master Data Table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Modify existing 'customers' table to link to master data
-- Assuming public.customers already exists from previous plans.
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- 4. Insert mock data for testing
INSERT INTO public.hospitals (name) 
VALUES 
    ('โรงพยาบาลศิริราช (Siriraj Hospital)'), 
    ('โรงพยาบาลจุฬาลงกรณ์ (Chulalongkorn Hospital)'), 
    ('โรงพยาบาลรามาธิบดี (Ramathibodi Hospital)'), 
    ('โรงพยาบาลราชวิถี (Rajavithi Hospital)'),
    ('โรงพยาบาลบำรุงราษฎร์ (Bumrungrad Hospital)'),
    ('โรงพยาบาลกรุงเทพ (Bangkok Hospital)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.departments (name) 
VALUES 
    ('แผนกผู้ป่วยนอก (OPD)'), 
    ('แผนกผู้ป่วยใน (IPD)'), 
    ('แผนกฉุกเฉิน (ER)'), 
    ('แผนกศัลยกรรม (Surgery)'), 
    ('แผนกกุมารเวชกรรม (Pediatrics)'), 
    ('แผนกเทคโนโลยีสารสนเทศ (IT Department)'),
    ('แผนกจัดซื้อและพัสดุ (Procurement)')
ON CONFLICT (name) DO NOTHING;

-- 5. Row Level Security Policies (Safety)
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read hospitals and departments
CREATE POLICY "Allow public read-access for hospitals" 
ON public.hospitals FOR SELECT USING (true);

CREATE POLICY "Allow public read-access for departments" 
ON public.departments FOR SELECT USING (true);
