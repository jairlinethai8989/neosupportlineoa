const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

export function parseCustomerId(value: unknown) {
  const id = String(value ?? '').trim();
  if (!UUID_PATTERN.test(id)) throw new Error('Invalid customer id');
  return id;
}

function relationName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== 'object') return null;
  const name = (relation as Record<string, unknown>).name;
  return typeof name === 'string' ? { name } : null;
}

function metadataPictureUrl(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const lineProfile = (value as Record<string, unknown>).line_profile;
  if (!lineProfile || typeof lineProfile !== 'object' || Array.isArray(lineProfile)) return null;
  return optionalString((lineProfile as Record<string, unknown>).picture_url);
}

export function toCustomerDto(row: Record<string, unknown>) {
  return {
    id: optionalString(row.id),
    display_name: optionalString(row.display_name),
    full_name: optionalString(row.full_name),
    line_username: optionalString(row.line_username),
    line_user_id: optionalString(row.line_user_id),
    avatar_url: optionalString(row.avatar_url) || metadataPictureUrl(row.metadata),
    status: optionalString(row.status),
    organization_id: optionalString(row.organization_id),
    department_id: optionalString(row.department_id),
    position_id: optionalString(row.position_id),
    created_at: optionalString(row.created_at),
    organizations: relationName(row.organizations),
    departments: relationName(row.departments),
    positions: relationName(row.positions),
  };
}

export function toCustomerTicketDto(row: Record<string, unknown>) {
  return {
    id: optionalString(row.id),
    ticket_no: optionalString(row.ticket_no),
    subject: optionalString(row.subject),
    status: optionalString(row.status),
    created_at: optionalString(row.created_at),
  };
}
