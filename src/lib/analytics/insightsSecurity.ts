export type AnalyticsInsightsQuery = {
  preset: '7days' | '30days' | 'all';
  organizationId: string | null;
  startDate: string | null;
  endDate: string | null;
  organizationsOnly: boolean;
  ai: boolean;
  customPrompt: string;
};

export type GeneratedInsightsReport = {
  executiveSummary: string;
  keyChallenges: Array<{ title: string; description: string }>;
  actionItems: Array<{ action: string; owner: string; targetDate: string }>;
};

const ALLOWED_QUERY_KEYS = new Set([
  'preset',
  'organizationId',
  'startDate',
  'endDate',
  'organizationsOnly',
  'ai',
  'customPrompt',
]);
const PRESETS = new Set<AnalyticsInsightsQuery['preset']>(['7days', '30days', 'all']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EXPLICIT_RANGE_DAYS = 366;
const MAX_CUSTOM_PROMPT_LENGTH = 2000;

function parseBoolean(value: string | null, field: string) {
  if (value === null || value === 'false') return false;
  if (value === 'true') return true;
  throw new TypeError(`Invalid ${field}`);
}

function parseDate(value: string) {
  if (!DATE_PATTERN.test(value)) throw new TypeError('Invalid date range');
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new TypeError('Invalid date range');
  }
  return timestamp;
}

export function parseAnalyticsInsightsQuery(searchParams: URLSearchParams): AnalyticsInsightsQuery {
  if (searchParams.toString().length > 4096) throw new TypeError('Query is too large');

  for (const key of searchParams.keys()) {
    if (!ALLOWED_QUERY_KEYS.has(key) || searchParams.getAll(key).length !== 1) {
      throw new TypeError('Invalid analytics query');
    }
  }

  const presetValue = searchParams.get('preset') || 'all';
  if (!PRESETS.has(presetValue as AnalyticsInsightsQuery['preset'])) {
    throw new TypeError('Invalid analytics preset');
  }

  const organizationValue = searchParams.get('organizationId');
  const organizationId = !organizationValue || organizationValue === 'all' ? null : organizationValue;
  if (organizationId && !UUID_PATTERN.test(organizationId)) {
    throw new TypeError('Invalid organization id');
  }

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  if (Boolean(startDate) !== Boolean(endDate)) throw new TypeError('Invalid date range');
  if (startDate && endDate) {
    const startTimestamp = parseDate(startDate);
    const endTimestamp = parseDate(endDate);
    const rangeDays = (endTimestamp - startTimestamp) / 86_400_000;
    if (rangeDays < 0 || rangeDays > MAX_EXPLICIT_RANGE_DAYS) {
      throw new TypeError('Invalid date range');
    }
  }

  const customPrompt = (searchParams.get('customPrompt') || '').trim();
  if (
    customPrompt.length > MAX_CUSTOM_PROMPT_LENGTH ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(customPrompt)
  ) {
    throw new TypeError('Invalid custom prompt');
  }

  return {
    preset: presetValue as AnalyticsInsightsQuery['preset'],
    organizationId,
    startDate,
    endDate,
    organizationsOnly: parseBoolean(searchParams.get('organizationsOnly'), 'organizationsOnly flag'),
    ai: parseBoolean(searchParams.get('ai'), 'AI flag'),
    customPrompt,
  };
}

export function parseGeneratedInsightsReport(input: unknown): GeneratedInsightsReport {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Invalid generated insights report');
  }
  const report = input as Record<string, unknown>;
  assertExactKeys(report, ['executiveSummary', 'keyChallenges', 'actionItems']);
  if (!Array.isArray(report.keyChallenges) || !Array.isArray(report.actionItems)) {
    throw new TypeError('Invalid generated insights items');
  }
  if (report.keyChallenges.length > 5 || report.actionItems.length > 5) {
    throw new TypeError('Generated insights item limit exceeded');
  }

  return {
    executiveSummary: parseBoundedString(report.executiveSummary, 5000),
    keyChallenges: report.keyChallenges.map((value) => {
      const challenge = assertPlainRecord(value);
      assertExactKeys(challenge, ['title', 'description']);
      return {
        title: parseBoundedString(challenge.title, 300),
        description: parseBoundedString(challenge.description, 3000),
      };
    }),
    actionItems: report.actionItems.map((value) => {
      const item = assertPlainRecord(value);
      assertExactKeys(item, ['action', 'owner', 'targetDate']);
      const targetDate = parseBoundedString(item.targetDate, 10);
      parseDate(targetDate);
      return {
        action: parseBoundedString(item.action, 3000),
        owner: parseBoundedString(item.owner, 300),
        targetDate,
      };
    }),
  };
}

function assertPlainRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid generated insights object');
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]) {
  const expected = new Set(expectedKeys);
  if (Object.keys(value).length !== expected.size || Object.keys(value).some((key) => !expected.has(key))) {
    throw new TypeError('Unexpected generated insights field');
  }
}

function parseBoundedString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') throw new TypeError('Invalid generated insights text');
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    throw new TypeError('Invalid generated insights text');
  }
  return normalized;
}
