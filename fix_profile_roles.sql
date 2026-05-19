-- Phase 2: Enforce Profile Roles Data Consistency
-- Goal: Fix legacy 'Admin' roles to match 'Administrator' and apply DB constraint.

-- 1. Update any existing legacy 'Admin' profiles to 'Administrator'
UPDATE profiles 
SET role = 'Administrator' 
WHERE role = 'Admin';

-- 2. Drop the constraint if it already exists (to avoid errors)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 3. Add the definitive check constraint to prevent future mismatches
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('Administrator', 'Agent'));

-- End of Phase 2 Migration
