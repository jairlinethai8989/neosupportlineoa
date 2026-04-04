-- 0. Enable Extension for UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Master Data Tables
CREATE TABLE IF NOT EXISTS public.hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    abbreviation TEXT, -- Added to track existing schema
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure UNIQUE constraints exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospitals_name_key') THEN
    ALTER TABLE public.hospitals ADD CONSTRAINT hospitals_name_key UNIQUE (name);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_name_key') THEN
    ALTER TABLE public.departments ADD CONSTRAINT departments_name_key UNIQUE (name);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'positions_name_key') THEN
    ALTER TABLE public.positions ADD CONSTRAINT positions_name_key UNIQUE (name);
  END IF;
END $$;

-- 2. Create Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_user_id TEXT UNIQUE NOT NULL,
    display_name TEXT,
    email TEXT,
    phone TEXT,
    hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insert mock data (Including Abbreviations for Hospitals)
INSERT INTO public.hospitals (name, abbreviation) 
VALUES 
    ('โรงพยาบาลศิริราช (Siriraj Hospital)', 'SI'), 
    ('โรงพยาบาลจุฬาลงกรณ์ (Chulalongkorn Hospital)', 'KCMH'), 
    ('โรงพยาบาลรามาธิบดี (Ramathibodi Hospital)', 'RAMA'), 
    ('โรงพยาบาลราชวิถี (Rajavithi Hospital)', 'RJ'),
    ('โรงพยาบาลบำรุงราษฎร์ (Bumrungrad Hospital)', 'BH'),
    ('โรงพยาบาลกรุงเทพ (Bangkok Hospital)', 'BDMS')
ON CONFLICT (name) DO UPDATE SET abbreviation = EXCLUDED.abbreviation;

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

INSERT INTO public.positions (name) 
VALUES 
    ('แพทย์ (Physician)'), 
    ('พยาบาลวิชาชีพ (Registered Nurse)'), 
    ('เจ้าหน้าที่ไอที (IT Staff)'), 
    ('เจ้าหน้าที่ฝ่ายเทคนิค (Technical Staff)'),
    ('ผู้ช่วยพยาบาล (Nurse Aide)'),
    ('เจ้าหน้าที่ธุรการ (Administrative Staff)'),
    ('ผู้อำนวยการ/หัวหน้าแผนก (Director/Head)')
ON CONFLICT (name) DO NOTHING;

-- 4. Safety & RLS
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid confusion
DROP POLICY IF EXISTS "Allow public read-access for master data" ON public.hospitals;
DROP POLICY IF EXISTS "Allow public read-access for master data" ON public.departments;
DROP POLICY IF EXISTS "Allow public read-access for master data" ON public.positions;

CREATE POLICY "Allow public read-access for master data" 
ON public.hospitals FOR SELECT USING (true);

CREATE POLICY "Allow public read-access for master data" 
ON public.departments FOR SELECT USING (true);

CREATE POLICY "Allow public read-access for master data" 
ON public.positions FOR SELECT USING (true);

-- Customer RLS for Portal
DROP POLICY IF EXISTS "Allow individuals to update their own record" ON public.customers;
DROP POLICY IF EXISTS "Allow individuals to insert their own record" ON public.customers;
DROP POLICY IF EXISTS "Allow individuals to select their own record" ON public.customers;

CREATE POLICY "Allow individuals to update their own record" 
ON public.customers FOR UPDATE 
USING (true);

CREATE POLICY "Allow individuals to insert their own record" 
ON public.customers FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow individuals to select their own record" 
ON public.customers FOR SELECT 
USING (true);




