const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DATE_RANGE_DAYS = 366;

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid analytics request');
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const allowed = new Set(expected);
  if (Object.keys(value).length !== allowed.size || Object.keys(value).some((key) => !allowed.has(key))) {
    throw new TypeError('Invalid analytics request');
  }
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new TypeError('Invalid analytics date range');
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new TypeError('Invalid analytics date range');
  }
  return { value, timestamp };
}

export function parseAnalyticsDateRange(input: unknown) {
  assertPlainObject(input);
  assertExactKeys(input, ['startDate', 'endDate']);
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  const days = (end.timestamp - start.timestamp) / 86_400_000;
  if (days < 0 || days > MAX_DATE_RANGE_DAYS) {
    throw new TypeError('Invalid analytics date range');
  }
  return { startDate: start.value, endDate: end.value };
}

export function parseStaffAnalyticsRequest(input: unknown) {
  assertPlainObject(input);
  assertExactKeys(input, ['agentId', 'startDate', 'endDate']);
  if (typeof input.agentId !== 'string' || !UUID_PATTERN.test(input.agentId)) {
    throw new TypeError('Invalid analytics agent');
  }
  const range = parseAnalyticsDateRange({ startDate: input.startDate, endDate: input.endDate });
  return { agentId: input.agentId, ...range };
}

export function parseEvaluationLookupRequest(input: unknown) {
  return parseStaffAnalyticsRequest(input);
}
