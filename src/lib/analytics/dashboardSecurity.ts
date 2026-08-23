const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

function parseIsoTimestamp(value: unknown) {
  if (typeof value !== 'string' || value.length > 40) throw new TypeError('Invalid dashboard date range');
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError('Invalid dashboard date range');
  return { timestamp, iso: new Date(timestamp).toISOString() };
}

function parseOptionalFilter(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new TypeError(`Invalid dashboard ${field}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 120 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new TypeError(`Invalid dashboard ${field}`);
  }
  return normalized;
}

export function parseDashboardExportInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid dashboard export');
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set(['from', 'to', 'organizationId', 'module', 'issueType']);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new TypeError('Invalid dashboard export');

  const from = parseIsoTimestamp(input.from);
  const to = parseIsoTimestamp(input.to);
  if (to.timestamp < from.timestamp || to.timestamp - from.timestamp > MAX_RANGE_MS) {
    throw new TypeError('Invalid dashboard date range');
  }
  const organizationId = parseOptionalFilter(input.organizationId, 'organization');
  if (organizationId && !UUID_PATTERN.test(organizationId)) {
    throw new TypeError('Invalid dashboard organization');
  }
  return {
    from: from.iso,
    to: to.iso,
    organizationId,
    module: parseOptionalFilter(input.module, 'module'),
    issueType: parseOptionalFilter(input.issueType, 'issue type'),
  };
}

type AggregateRow = { name: string; value: number };

function aggregateRows(value: unknown): AggregateRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const name = String(row.name ?? '').trim().slice(0, 200);
    const count = Number(row.value);
    return name && Number.isFinite(count) && count >= 0 ? [{ name, value: count }] : [];
  });
}

export function toAnalyticsDashboardDto(value: unknown) {
  const source = typeof value === 'string' ? JSON.parse(value) : value;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('Invalid analytics dashboard result');
  }
  const row = source as Record<string, unknown>;
  const totalRecords = Number(row.total_records);
  return {
    total_records: Number.isFinite(totalRecords) && totalRecords >= 0 ? totalRecords : 0,
    status_data: aggregateRows(row.status_data),
    priority_data: aggregateRows(row.priority_data),
    trend_data: aggregateRows(row.trend_data),
    category_data: aggregateRows(row.category_data),
    peak_data: aggregateRows(row.peak_data),
    resolution_data: aggregateRows(row.resolution_data),
    csat_data: aggregateRows(row.csat_data),
    sla_data: aggregateRows(row.sla_data),
  };
}
