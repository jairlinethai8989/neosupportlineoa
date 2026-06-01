-- 1. Rename foreign key constraint on tickets table from hospital_id_fkey to organization_id_fkey
ALTER TABLE public.tickets 
RENAME CONSTRAINT tickets_hospital_id_fkey TO tickets_organization_id_fkey;

-- 2. Rename foreign key constraint on customers table from hospital_id_fkey to organization_id_fkey
ALTER TABLE public.customers 
RENAME CONSTRAINT customers_hospital_id_fkey TO customers_organization_id_fkey;
