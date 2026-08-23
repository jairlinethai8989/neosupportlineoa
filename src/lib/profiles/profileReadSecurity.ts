const OWN_PROFILE_KEYS = [
  'id',
  'email',
  'role',
  'full_name',
  'avatar_url',
  'permissions',
  'status',
  'last_seen',
  'department',
  'landing_page',
  'theme_color',
  'signature_url',
  'quick_replies',
  'resolution_templates',
  'auto_logout_minutes',
  'notif_sound_enabled',
  'notif_sound_mode',
  'notif_sound_voice',
  'notif_event_new_ticket',
  'notif_event_new_message',
  'notif_event_transfer',
  'notif_event_sla_warning',
] as const;

export type OwnProfileDto = Partial<Record<(typeof OWN_PROFILE_KEYS)[number], unknown>>;

export function toOwnProfileDto(row: Record<string, unknown> | null | undefined): OwnProfileDto | null {
  if (!row) return null;
  const dto: OwnProfileDto = {};
  for (const key of OWN_PROFILE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(row, key)) dto[key] = row[key];
  }
  return dto;
}

export function toStaffDirectoryDto(row: Record<string, unknown>) {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    full_name: typeof row.full_name === 'string' ? row.full_name : '',
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    status: typeof row.status === 'string' ? row.status : 'Offline',
    department: typeof row.department === 'string' ? row.department : null,
  };
}

export function toStaffManagementDto(row: Record<string, unknown>) {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    full_name: typeof row.full_name === 'string' ? row.full_name : '',
    email: typeof row.email === 'string' ? row.email : '',
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    department: typeof row.department === 'string' ? row.department : null,
    role: typeof row.role === 'string' ? row.role : '',
    status: typeof row.status === 'string' ? row.status : '',
    permissions:
      row.permissions && typeof row.permissions === 'object' && !Array.isArray(row.permissions)
        ? row.permissions as Record<string, unknown>
        : {},
  };
}
