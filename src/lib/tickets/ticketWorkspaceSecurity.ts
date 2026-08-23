const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_SEARCH_PATTERN = /^[\p{L}\p{M}\p{N}\s\-/:#@]+$/u;
const SORT_KEYS = new Set([
  'ticket_no', 'created_at', 'subject', 'organization', 'customer', 'agent', 'status', 'priority',
]);

function parseDate(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length > 40) throw new TypeError(`Invalid ${field}`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError(`Invalid ${field}`);
  return { timestamp, iso: new Date(timestamp).toISOString() };
}

export function parseTicketWorkspaceListInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid ticket workspace query');
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set(['fromIso', 'toIso', 'limit', 'page', 'searchTerm', 'sortKey', 'sortDirection']);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new TypeError('Invalid ticket workspace query');
  }

  const from = parseDate(input.fromIso, 'ticket start date');
  const to = parseDate(input.toIso, 'ticket end date');
  if (from.timestamp > to.timestamp || from.timestamp < Date.parse('2000-01-01T00:00:00.000Z')) {
    throw new TypeError('Invalid ticket date range');
  }
  const limit = Number(input.limit ?? 50);
  const page = Number(input.page ?? 1);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 201) throw new TypeError('Invalid ticket page size');
  if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) throw new TypeError('Invalid ticket page');

  const searchTerm = String(input.searchTerm ?? '').trim();
  if (searchTerm.length > 120 || (searchTerm && !SAFE_SEARCH_PATTERN.test(searchTerm))) {
    throw new TypeError('Invalid ticket search');
  }
  const sortKey = String(input.sortKey || 'created_at');
  if (!SORT_KEYS.has(sortKey)) throw new TypeError('Invalid ticket sort');
  const sortDirection = input.sortDirection || 'desc';
  if (sortDirection !== 'asc' && sortDirection !== 'desc') throw new TypeError('Invalid ticket sort');

  return {
    fromIso: from.iso,
    toIso: to.iso,
    limit,
    page,
    searchTerm,
    sortKey,
    sortDirection,
  } as const;
}

export function parseTicketWorkspaceId(value: unknown, field = 'ticket id') {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new TypeError(`Invalid ${field}`);
  return value;
}
