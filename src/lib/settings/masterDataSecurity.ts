const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const MASTER_TABLE_BY_TAB = {
  organizations: 'organizations',
  departments: 'departments',
  hospital_depts: 'departments',
  positions: 'positions',
  modules: 'ticket_modules',
  issue_types: 'ticket_issue_types',
  subject_types: 'ticket_subject_types',
  line_groups: 'line_groups',
} as const;

export type MasterDataTab = keyof typeof MASTER_TABLE_BY_TAB;

function parseBase(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid master data');
  const input = value as Record<string, unknown>;
  const tab = String(input.tab ?? '') as MasterDataTab;
  const table = MASTER_TABLE_BY_TAB[tab];
  const name = String(input.name ?? '').trim();
  if (!table || name.length < 1 || name.length > 160) throw new Error('Invalid master data');
  return { input, tab, table, name };
}

function buildMutablePayload(tab: MasterDataTab, name: string, abbreviationValue: unknown, creating: boolean) {
  const payload: Record<string, string | boolean> = { name };
  if (tab === 'organizations') {
    const fallback = name.slice(0, 10).toUpperCase().replace(/\s+/g, '_');
    const abbreviation = String(abbreviationValue ?? '').trim() || fallback;
    if (!IDENTIFIER_PATTERN.test(abbreviation) || abbreviation.length > 20) throw new Error('Invalid master data');
    payload.abbreviation = abbreviation;
    if (creating) payload.ticket_prefix = `SRS_${abbreviation}_`;
  }
  if (tab === 'line_groups') {
    const groupId = String(abbreviationValue ?? '').trim();
    if (!IDENTIFIER_PATTERN.test(groupId)) throw new Error('Invalid master data');
    payload.group_id = groupId;
  }
  if (tab === 'departments' || tab === 'hospital_depts') payload.dept_type = 'organization';
  if (creating) payload.is_active = true;
  return payload;
}

export function parseMasterCreateInput(value: unknown) {
  const { input, tab, table, name } = parseBase(value);
  return { table, tab, payload: buildMutablePayload(tab, name, input.abbreviation, true) };
}

export function parseMasterUpdateInput(value: unknown) {
  const { input, tab, table, name } = parseBase(value);
  const id = String(input.id ?? '').trim();
  if (!UUID_PATTERN.test(id)) throw new Error('Invalid master data');
  return { table, tab, id, payload: buildMutablePayload(tab, name, input.abbreviation, false) };
}

export function parseMasterToggleInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid master data');
  const input = value as Record<string, unknown>;
  const tab = String(input.tab ?? '') as MasterDataTab;
  const table = MASTER_TABLE_BY_TAB[tab];
  const id = String(input.id ?? '').trim();
  if (!table || !UUID_PATTERN.test(id) || typeof input.isActive !== 'boolean') throw new Error('Invalid master data');
  return { table, tab, id, isActive: input.isActive };
}

export function parseMasterListTab(value: unknown) {
  const tab = String(value ?? '') as MasterDataTab;
  const table = MASTER_TABLE_BY_TAB[tab];
  if (!table) throw new Error('Invalid master data');
  return { tab, table };
}

export function toMasterDataDto(tab: string, value: unknown) {
  const row = (value || {}) as Record<string, unknown>;
  const dto: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    is_active: row.is_active,
  };
  if (tab === 'organizations') {
    dto.abbreviation = row.abbreviation;
    dto.ticket_prefix = row.ticket_prefix;
  }
  if (tab === 'line_groups') dto.group_id = row.group_id;
  if (tab === 'departments' || tab === 'hospital_depts') dto.dept_type = row.dept_type;
  return dto;
}
