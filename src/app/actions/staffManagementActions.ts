'use server';

import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import { toStaffManagementDto } from '@/lib/profiles/profileReadSecurity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function getStaffManagementDataAction() {
  await requireStaffAuth({ permission: 'settings_staff', level: 'view' });
  const [profiles, departments] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, avatar_url, department, role, status, permissions')
      .order('full_name'),
    supabaseAdmin
      .from('departments')
      .select('name')
      .eq('is_active', true)
      .eq('dept_type', 'organization')
      .order('name'),
  ]);
  if (profiles.error || departments.error) throw new Error('Failed to load staff management data');
  return {
    staff: (profiles.data || []).map((row) => toStaffManagementDto(row as Record<string, unknown>)),
    departments: (departments.data || [])
      .map((row) => typeof row.name === 'string' ? row.name : '')
      .filter(Boolean),
  };
}
