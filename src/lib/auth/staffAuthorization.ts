import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export type StaffRole = 'Agent' | 'Administrator';
export type StaffPermissionLevel = 'view' | 'edit';

export type StaffRequirement = {
  roles?: readonly StaffRole[];
  permission?: string;
  level?: StaffPermissionLevel;
};

export type StaffProfile = {
  role: string;
  permissions: Record<string, unknown>;
};

export type StaffIdentity = {
  user: User;
  profile: StaffProfile & { role: StaffRole };
};

export class StaffAuthorizationError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403) {
    super(status === 401 ? 'Unauthorized' : 'Forbidden');
    this.name = 'StaffAuthorizationError';
    this.status = status;
  }
}

const DEFAULT_STAFF_ROLES: readonly StaffRole[] = ['Agent', 'Administrator'];

export function hasStaffAccess(
  profile: StaffProfile | null | undefined,
  requirement: StaffRequirement = {}
) {
  if (!profile || !DEFAULT_STAFF_ROLES.includes(profile.role as StaffRole)) return false;

  const roles = requirement.roles || DEFAULT_STAFF_ROLES;
  if (!roles.includes(profile.role as StaffRole)) return false;
  if (!requirement.permission || profile.role === 'Administrator') return true;

  const granted = profile.permissions?.[requirement.permission];
  const requiredLevel = requirement.level || 'view';
  return requiredLevel === 'edit' ? granted === 'edit' : granted === 'view' || granted === 'edit';
}

export async function requireStaffAuth(
  requirement: StaffRequirement = {}
): Promise<StaffIdentity> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new StaffAuthorizationError(401);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, permissions')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) {
    throw new StaffAuthorizationError(403);
  }
  if (!hasStaffAccess(profile, requirement)) {
    throw new StaffAuthorizationError(403);
  }

  return {
    user,
    profile: {
      role: profile.role as StaffRole,
      permissions:
        profile.permissions && typeof profile.permissions === 'object' && !Array.isArray(profile.permissions)
          ? profile.permissions
          : {},
    },
  };
}

export async function getStaffAuth(requirement: StaffRequirement = {}) {
  try {
    return await requireStaffAuth(requirement);
  } catch (error) {
    if (error instanceof StaffAuthorizationError) return null;
    throw error;
  }
}
