export const SLA_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

export type SlaPriority = (typeof SLA_PRIORITIES)[number];

export type SlaRuleInput = {
  id?: unknown;
  priority: unknown;
  response_time_minutes: unknown;
  resolution_time_minutes: unknown;
};

export type SafeSlaRule = {
  id?: string;
  priority: SlaPriority;
  response_time_minutes: number;
  resolution_time_minutes: number;
};

function parseNonNegativeInteger(value: unknown, field: string) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 525600) {
    throw new Error(`Invalid ${field}`);
  }
  return parsed;
}

function parsePriority(value: unknown): SlaPriority {
  if (typeof value !== 'string' || !SLA_PRIORITIES.includes(value as SlaPriority)) {
    throw new Error('Invalid SLA priority');
  }
  return value as SlaPriority;
}

function parseOptionalUuid(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error('Invalid SLA rule id');
  }
  return value;
}

export function parseSlaRuleInput(input: SlaRuleInput): SafeSlaRule {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid SLA rule');
  }

  return {
    id: parseOptionalUuid(input.id),
    priority: parsePriority(input.priority),
    response_time_minutes: parseNonNegativeInteger(input.response_time_minutes, 'response time'),
    resolution_time_minutes: parseNonNegativeInteger(input.resolution_time_minutes, 'resolution time'),
  };
}

export function parseSlaRulesInput(value: unknown) {
  if (!Array.isArray(value) || value.length > SLA_PRIORITIES.length) {
    throw new Error('Invalid SLA rules');
  }

  const seen = new Set<SlaPriority>();
  return value.map((rule) => {
    const parsed = parseSlaRuleInput(rule as SlaRuleInput);
    if (seen.has(parsed.priority)) {
      throw new Error('Duplicate SLA priority');
    }
    seen.add(parsed.priority);
    return parsed;
  });
}
