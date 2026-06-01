-- 1. Rename table `hospitals` to `organizations`
ALTER TABLE public.hospitals RENAME TO organizations;

-- 2. Rename columns in `customers`
ALTER TABLE public.customers RENAME COLUMN hospital_id TO organization_id;

-- 3. Rename columns in `tickets`
ALTER TABLE public.tickets RENAME COLUMN hospital_id TO organization_id;

-- 4. Rename indexes
ALTER INDEX IF EXISTS idx_customers_hospital_id RENAME TO idx_customers_organization_id;
ALTER INDEX IF EXISTS idx_tickets_hospital_id RENAME TO idx_tickets_organization_id;

-- 5. Rename policies
ALTER POLICY "Allow public read on hospitals" ON public.organizations RENAME TO "Allow public read on organizations";

-- 6. Update the stored procedure `get_dashboard_summary_v2`
-- Wait, actually we can just drop and recreate it.

-- 6. Update the stored procedure get_dashboard_summary_v2 (assuming this is the current one, but wait... setup_dashboard_rpc.sql defines get_dashboard_summary)
DROP FUNCTION IF EXISTS get_dashboard_summary(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_dashboard_summary_v2(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_dashboard_summary_v3(TIMESTAMPTZ, TIMESTAMPTZ);
-- We will rebuild it with 'organizations' and 'organizationData'
