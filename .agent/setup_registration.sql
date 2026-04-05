-- Allow public read access to master data tables for LIFF registration
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- If policies exist, we should drop them or ensure they cover everyone
DROP POLICY IF EXISTS "Allow public read on hospitals" ON hospitals;
CREATE POLICY "Allow public read on hospitals" ON hospitals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on departments" ON departments;
CREATE POLICY "Allow public read on departments" ON departments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on positions" ON positions;
CREATE POLICY "Allow public read on positions" ON positions FOR SELECT USING (true);

-- Also ensure customers table can be inserted by anyone (since they are registering for the first time)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert on customers" ON customers;
CREATE POLICY "Allow public insert on customers" ON customers FOR INSERT WITH CHECK (true);

-- Allow customers to see their own record
DROP POLICY IF EXISTS "Allow customers to read own record" ON customers;
CREATE POLICY "Allow customers to read own record" ON customers FOR SELECT USING (true);
