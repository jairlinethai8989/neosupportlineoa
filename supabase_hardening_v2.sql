-- =============================================================
-- NeoSupport Security Hardening Migration (RLS v2)
-- =============================================================
-- Purpose:
--   Implement server-side permission checks that mirror the UI logic.
--   Prevents unauthorized data manipulation via direct API calls.
-- =============================================================

BEGIN;

-- 1. Helper Function to check permissions
CREATE OR REPLACE FUNCTION public.has_perm(perm_key text, required_level text DEFAULT 'edit')
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (
      role = 'Administrator'
      OR (
        required_level = 'view' AND (permissions->>perm_key = 'view' OR permissions->>perm_key = 'edit')
      )
      OR (
        required_level = 'edit' AND permissions->>perm_key = 'edit'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Hardening [public.profiles]
-- Admins or Staff Managers can update profiles. 
-- Regular users can only update their own non-sensitive fields (handing separately in a more complex policy or keeping it simple).
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins and Staff Managers can update all profiles" ON public.profiles;

-- Allow users to update their own basic info (not role/permissions)
CREATE POLICY "Users can update own identity"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid())) -- Cannot change own role
  AND (permissions = (SELECT permissions FROM public.profiles WHERE id = auth.uid())) -- Cannot change own perms
);

-- Allow Staff Managers or Admins to update anyone
CREATE POLICY "Managers can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_perm('settings_staff', 'edit'));

-- Create policy for Delete
DROP POLICY IF EXISTS "Managers can delete profiles" ON public.profiles;
CREATE POLICY "Managers can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.has_perm('settings_staff', 'edit'));


-- 3. Hardening [public.company_settings]
DROP POLICY IF EXISTS "Admins can update company settings." ON public.company_settings;
CREATE POLICY "Managers can update company settings"
ON public.company_settings FOR UPDATE
TO authenticated
USING (public.has_perm('settings_branding', 'edit'));


-- 4. Hardening [public.sla_rules]
DROP POLICY IF EXISTS "Allow authenticated write for sla_rules" ON public.sla_rules;
CREATE POLICY "Managers can manage sla_rules"
ON public.sla_rules FOR ALL
TO authenticated
USING (public.has_perm('settings_sla', 'edit'))
WITH CHECK (public.has_perm('settings_sla', 'edit'));


-- 5. Hardening [public.hospitals, public.departments, public.positions]
DROP POLICY IF EXISTS "Managers can manage hospitals" ON public.hospitals;
CREATE POLICY "Managers can manage hospitals"
ON public.hospitals FOR ALL TO authenticated
USING (public.has_perm('settings_master', 'edit'));

DROP POLICY IF EXISTS "Managers can manage departments" ON public.departments;
CREATE POLICY "Managers can manage departments"
ON public.departments FOR ALL TO authenticated
USING (public.has_perm('settings_master', 'edit'));

DROP POLICY IF EXISTS "Managers can manage positions" ON public.positions;
CREATE POLICY "Managers can manage positions"
ON public.positions FOR ALL TO authenticated
USING (public.has_perm('settings_master', 'edit'));


-- 6. Hardening Audit Logs (Only viewable by Audit Managers)
DROP POLICY IF EXISTS "Agents can view system logs" ON public.system_logs;
CREATE POLICY "Audit managers can view system logs"
ON public.system_logs FOR SELECT TO authenticated
USING (public.has_perm('settings_audit', 'view'));

COMMIT;
