const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_DATE_RANGE_DAYS = 366;

const SCORE_KEYS = [
  'system_data_expertise',
  'troubleshooting_sla',
  'shift_availability',
  'handover_quality',
  'knowledge_sharing',
  'crisis_communication',
  'emotional_regulation',
  'learning_agility',
] as const;

type EvaluationScoreKey = (typeof SCORE_KEYS)[number];

export type Evaluation360Data = Record<EvaluationScoreKey, number> & {
  comments: string;
  is_ai_generated: boolean;
};

type Evaluation360Base = {
  agentId: string;
  startDate: string;
  endDate: string;
  period: string;
};

export type Evaluation360Read = Evaluation360Base & {
  evaluatorRole: 'lead' | 'peer' | 'user' | 'self';
};

export type Evaluation360Post =
  | (Evaluation360Base & { action: 'generate-ai' })
  | (Evaluation360Base & {
      action: 'save';
      evaluatorRole: 'lead' | 'peer' | 'user' | 'self';
      evaluationData: Evaluation360Data;
    });

export function parseEvaluation360Query(agentId: string | null, period: string | null) {
  if (!agentId || !UUID_PATTERN.test(agentId)) {
    throw new TypeError('Invalid agent id');
  }
  if (!period || !PERIOD_PATTERN.test(period)) {
    throw new TypeError('Invalid evaluation period');
  }
  return { agentId, period };
}

function assertPlainObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(message);
  }
}

function parseDate(value: unknown): { raw: string; timestamp: number } {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new TypeError('Invalid date range');
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new TypeError('Invalid date range');
  }
  return { raw: value, timestamp };
}

function parseBase(candidate: Record<string, unknown>): Evaluation360Base {
  if (typeof candidate.agentId !== 'string' || !UUID_PATTERN.test(candidate.agentId)) {
    throw new TypeError('Invalid agent id');
  }

  const start = parseDate(candidate.startDate);
  const end = parseDate(candidate.endDate);
  const rangeDays = (end.timestamp - start.timestamp) / 86_400_000;
  if (rangeDays < 0 || rangeDays > MAX_DATE_RANGE_DAYS) {
    throw new TypeError('Invalid date range');
  }

  if (typeof candidate.period !== 'string' || !PERIOD_PATTERN.test(candidate.period)) {
    throw new TypeError('Invalid evaluation period');
  }

  return {
    agentId: candidate.agentId,
    startDate: start.raw,
    endDate: end.raw,
    period: candidate.period,
  };
}

function parseEvaluationData(value: unknown): Evaluation360Data {
  assertPlainObject(value, 'Invalid evaluation data');
  const allowedKeys = new Set<string>([...SCORE_KEYS, 'comments', 'is_ai_generated']);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new TypeError('Unknown evaluation field');
  }

  const scores = {} as Record<EvaluationScoreKey, number>;
  for (const key of SCORE_KEYS) {
    const score = value[key];
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
      throw new TypeError('Invalid evaluation score');
    }
    scores[key] = score;
  }

  if (typeof value.comments !== 'string' || value.comments.length > 5000) {
    throw new TypeError('Invalid evaluation comments');
  }
  if (value.is_ai_generated !== undefined && typeof value.is_ai_generated !== 'boolean') {
    throw new TypeError('Invalid AI evaluation flag');
  }

  return {
    ...scores,
    comments: value.comments.trim(),
    is_ai_generated: value.is_ai_generated === true,
  };
}

export function parseGeneratedEvaluation360(input: unknown) {
  assertPlainObject(input, 'Invalid generated evaluation');
  if (Object.keys(input).some((key) => key !== 'scores' && key !== 'comments')) {
    throw new TypeError('Unknown generated evaluation field');
  }
  assertPlainObject(input.scores, 'Invalid generated evaluation scores');

  const parsed = parseEvaluationData({
    ...input.scores,
    comments: input.comments,
    is_ai_generated: true,
  });
  const { comments, is_ai_generated, ...scores } = parsed;
  return { scores, comments, is_ai_generated };
}

export function parseEvaluation360Post(input: unknown): Evaluation360Post {
  assertPlainObject(input, 'Invalid evaluation request');
  if (input.action !== 'generate-ai' && input.action !== 'save') {
    throw new TypeError('Invalid action');
  }

  const allowedKeys = new Set(
    input.action === 'save'
      ? ['action', 'agentId', 'startDate', 'endDate', 'period', 'evaluatorRole', 'evaluationData']
      : ['action', 'agentId', 'startDate', 'endDate', 'period']
  );
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    throw new TypeError('Unknown field');
  }

  const base = parseBase(input);
  if (input.action === 'generate-ai') {
    return { action: input.action, ...base };
  }

  if (!['lead', 'peer', 'user', 'self'].includes(String(input.evaluatorRole))) {
    throw new TypeError('Invalid evaluator role');
  }

  return {
    action: input.action,
    ...base,
    evaluatorRole: input.evaluatorRole as 'lead' | 'peer' | 'user' | 'self',
    evaluationData: parseEvaluationData(input.evaluationData),
  };
}

export function parseEvaluation360Read(input: unknown): Evaluation360Read {
  assertPlainObject(input, 'Invalid evaluation request');
  const allowedKeys = new Set(['agentId', 'startDate', 'endDate', 'period', 'evaluatorRole']);
  if (Object.keys(input).length !== allowedKeys.size || Object.keys(input).some((key) => !allowedKeys.has(key))) {
    throw new TypeError('Unknown field');
  }
  if (!['lead', 'peer', 'user', 'self'].includes(String(input.evaluatorRole))) {
    throw new TypeError('Invalid evaluator role');
  }
  return {
    ...parseBase(input),
    evaluatorRole: input.evaluatorRole as Evaluation360Read['evaluatorRole'],
  };
}
