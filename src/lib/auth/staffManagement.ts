const STAFF_PERMISSION_KEYS = new Set([
  'analytics',
  'analytics_personal',
  'analytics_staff',
  'inbox',
  'tickets',
  'notifications',
  'customers',
  'reports',
  'settings_profile',
  'settings_branding',
  'settings_staff',
  'settings_sla',
  'settings_master',
  'settings_audit',
]);

const STAFF_PERMISSION_LEVELS = new Set(['none', 'view', 'edit']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAFF_CREATE_KEYS = new Set(['username', 'password', 'full_name', 'role', 'department']);
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export type StaffCreate = {
  username: string;
  password: string;
  fullName: string;
  role: 'Agent' | 'Administrator';
  department: string | null;
};

export function parseStaffCreate(input: unknown): StaffCreate {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Invalid staff account');
  }

  const candidate = input as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !STAFF_CREATE_KEYS.has(key))) {
    throw new TypeError('Unknown field');
  }

  const username = typeof candidate.username === 'string' ? candidate.username.trim().toLowerCase() : '';
  if (!USERNAME_PATTERN.test(username)) {
    throw new TypeError('Invalid username');
  }

  if (typeof candidate.password !== 'string' || candidate.password.length < 12 || candidate.password.length > 128) {
    throw new TypeError('Invalid password');
  }

  const fullName = typeof candidate.full_name === 'string' ? candidate.full_name.trim() : '';
  if (!fullName || fullName.length > 200) {
    throw new TypeError('Invalid full name');
  }

  if (candidate.role !== 'Agent' && candidate.role !== 'Administrator') {
    throw new TypeError('Invalid role');
  }

  let department: string | null = null;
  if (candidate.department !== undefined && candidate.department !== null) {
    if (typeof candidate.department !== 'string' || candidate.department.trim().length > 200) {
      throw new TypeError('Invalid department');
    }
    department = candidate.department.trim() || null;
  }

  return {
    username,
    password: candidate.password,
    fullName,
    role: candidate.role,
    department,
  };
}

export type StaffPermissionUpdate = {
  id: string;
  permissions: Record<string, 'none' | 'view' | 'edit'>;
};

export function parseStaffPermissionUpdate(input: unknown): StaffPermissionUpdate {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Invalid permissions');
  }

  const candidate = input as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || !UUID_PATTERN.test(candidate.id)) {
    throw new TypeError('Invalid staff id');
  }
  if (!candidate.permissions || typeof candidate.permissions !== 'object' || Array.isArray(candidate.permissions)) {
    throw new TypeError('Invalid permissions');
  }

  const permissions = candidate.permissions as Record<string, unknown>;
  for (const [key, value] of Object.entries(permissions)) {
    if (!STAFF_PERMISSION_KEYS.has(key) || typeof value !== 'string' || !STAFF_PERMISSION_LEVELS.has(value)) {
      throw new TypeError('Invalid permissions');
    }
  }

  return {
    id: candidate.id,
    permissions: permissions as StaffPermissionUpdate['permissions'],
  };
}

export function parseStaffId(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Invalid staff id');
  }
  const id = (input as Record<string, unknown>).id;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    throw new TypeError('Invalid staff id');
  }
  return id;
}
