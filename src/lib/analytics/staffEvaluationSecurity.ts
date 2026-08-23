const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UNSAFE_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const MAX_DATE_RANGE_DAYS = 366;
const MAX_COUNT = 1_000_000;

const KPI_KEYS = [
  'resolvedCount',
  'totalClaimed',
  'avgResolutionTime',
  'slaComplianceRate',
  'reworkRate',
  'reworkCount',
  'avgCsat',
] as const;

const DIMENSION_KEYS = ['speed', 'quality', 'sla', 'csat'] as const;

export type StaffEvaluationKpiStats = {
  resolvedCount: number;
  totalClaimed: number;
  avgResolutionTime: number;
  slaComplianceRate: number;
  reworkRate: number;
  reworkCount: number;
  avgCsat: number;
};

export type StaffEvaluationRequest = {
  agentId: string;
  agentName: string;
  startDate: string;
  endDate: string;
  kpiStats: StaffEvaluationKpiStats;
};

export type GeneratedStaffEvaluation = {
  dimensions: Record<(typeof DIMENSION_KEYS)[number], { rating: number; feedback: string }>;
  strengths: string[];
  recommendations: string[];
  overallSummary: string;
};

function assertPlainObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(message);
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], message: string) {
  const expectedSet = new Set(expected);
  const actual = Object.keys(value);
  if (actual.length !== expectedSet.size || actual.some((key) => !expectedSet.has(key))) {
    throw new TypeError(message);
  }
}

function parseBoundedText(value: unknown, maxLength: number, message: string) {
  if (typeof value !== 'string') throw new TypeError(message);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || UNSAFE_CONTROL_PATTERN.test(normalized)) {
    throw new TypeError(message);
  }
  return normalized;
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new TypeError('Invalid evaluation date range');
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new TypeError('Invalid evaluation date range');
  }
  return { raw: value, timestamp };
}

function parseNumber(value: unknown, min: number, max: number, integer = false) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new TypeError('Invalid evaluation KPI');
  }
  return value;
}

export function parseStaffEvaluationRequest(input: unknown): StaffEvaluationRequest {
  assertPlainObject(input, 'Invalid evaluation request');
  assertExactKeys(
    input,
    ['agentId', 'agentName', 'startDate', 'endDate', 'kpiStats'],
    'Invalid evaluation request fields'
  );

  if (typeof input.agentId !== 'string' || !UUID_PATTERN.test(input.agentId)) {
    throw new TypeError('Invalid agent id');
  }
  const agentName = parseBoundedText(input.agentName, 200, 'Invalid agent name');
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  const rangeDays = (end.timestamp - start.timestamp) / 86_400_000;
  if (rangeDays < 0 || rangeDays > MAX_DATE_RANGE_DAYS) {
    throw new TypeError('Invalid evaluation date range');
  }

  assertPlainObject(input.kpiStats, 'Invalid evaluation KPI');
  assertExactKeys(input.kpiStats, KPI_KEYS, 'Invalid evaluation KPI fields');
  const kpiStats: StaffEvaluationKpiStats = {
    resolvedCount: parseNumber(input.kpiStats.resolvedCount, 0, MAX_COUNT, true),
    totalClaimed: parseNumber(input.kpiStats.totalClaimed, 0, MAX_COUNT, true),
    avgResolutionTime: parseNumber(input.kpiStats.avgResolutionTime, 0, 1_000_000),
    slaComplianceRate: parseNumber(input.kpiStats.slaComplianceRate, 0, 100),
    reworkRate: parseNumber(input.kpiStats.reworkRate, 0, 100),
    reworkCount: parseNumber(input.kpiStats.reworkCount, 0, MAX_COUNT, true),
    avgCsat: parseNumber(input.kpiStats.avgCsat, 0, 5),
  };

  return {
    agentId: input.agentId,
    agentName,
    startDate: start.raw,
    endDate: end.raw,
    kpiStats,
  };
}

export function parseStaffEvaluationQuery(searchParams: URLSearchParams) {
  const keys = [...searchParams.keys()];
  if (
    searchParams.toString().length > 64 ||
    keys.some((key) => key !== 'force') ||
    searchParams.getAll('force').length > 1
  ) {
    throw new TypeError('Invalid evaluation query');
  }

  const force = searchParams.get('force');
  if (force === null || force === 'false') return { force: false };
  if (force === 'true') return { force: true };
  throw new TypeError('Invalid force flag');
}

export function parseGeneratedStaffEvaluation(input: unknown): GeneratedStaffEvaluation {
  assertPlainObject(input, 'Invalid generated evaluation');
  assertExactKeys(
    input,
    ['dimensions', 'strengths', 'recommendations', 'overallSummary'],
    'Invalid generated evaluation fields'
  );

  assertPlainObject(input.dimensions, 'Invalid generated evaluation dimensions');
  assertExactKeys(input.dimensions, DIMENSION_KEYS, 'Invalid generated evaluation dimensions');

  const dimensions = {} as GeneratedStaffEvaluation['dimensions'];
  for (const key of DIMENSION_KEYS) {
    const dimension = input.dimensions[key];
    assertPlainObject(dimension, 'Invalid generated evaluation dimension');
    assertExactKeys(dimension, ['rating', 'feedback'], 'Invalid generated evaluation dimension fields');
    dimensions[key] = {
      rating: parseNumber(dimension.rating, 0, 100, true),
      feedback: parseBoundedText(dimension.feedback, 2000, 'Invalid generated evaluation feedback'),
    };
  }

  return {
    dimensions,
    strengths: parseTextList(input.strengths, 'Invalid generated evaluation strengths'),
    recommendations: parseTextList(
      input.recommendations,
      'Invalid generated evaluation recommendations'
    ),
    overallSummary: parseBoundedText(
      input.overallSummary,
      5000,
      'Invalid generated evaluation summary'
    ),
  };
}

function parseTextList(value: unknown, message: string) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) {
    throw new TypeError(message);
  }
  return value.map((item) => parseBoundedText(item, 1000, message));
}
