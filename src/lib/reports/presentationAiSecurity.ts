export type PresentationAiRequest = {
  ticketData: {
    dateRange: { start: string; end: string };
    summary: {
      totalTickets: number;
      resolvedTickets: number;
      resolvedRate: number;
      topHospital: { name: string; count: number };
      topCategory: { name: string; count: number };
    };
    categories: Array<{ name: string; count: number }>;
    topOrganizations: Array<{
      name: string;
      totalTickets: number;
      resolvedTickets: number;
      tickets: Array<{
        id: string;
        subject: string;
        status: string;
        issue_type: string;
        created_at: string;
      }>;
    }>;
  };
  customPrompt: string;
};

export type GeneratedPresentationInsights = {
  executiveSummary: string;
  keyChallenges: Array<{ title: string; description: string }>;
  actionItems: Array<{ action: string; owner: string; targetDate: string }>;
  hospitalInsights: Record<string, string>;
};

const UNSAFE_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DATE_RANGE_DAYS = 366;
const MAX_COUNT = 1_000_000;

function assertPlainObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(message);
  }
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], message: string) {
  const expected = new Set(keys);
  const actual = Object.keys(value);
  if (actual.length !== expected.size || actual.some((key) => !expected.has(key))) {
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
    throw new TypeError('Invalid presentation date range');
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new TypeError('Invalid presentation date range');
  }
  return { raw: value, timestamp };
}

function parseNumber(value: unknown, min: number, max: number, integer = true) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new TypeError('Invalid presentation metric');
  }
  return value;
}

function parseNamedCount(value: unknown) {
  assertPlainObject(value, 'Invalid presentation named count');
  assertExactKeys(value, ['name', 'count'], 'Invalid presentation named count fields');
  return {
    name: parseBoundedText(value.name, 300, 'Invalid presentation name'),
    count: parseNumber(value.count, 0, MAX_COUNT),
  };
}

function parsePresentationTicket(value: unknown) {
  assertPlainObject(value, 'Invalid presentation ticket');
  assertExactKeys(
    value,
    ['id', 'subject', 'status', 'issue_type', 'created_at'],
    'Invalid presentation ticket fields'
  );
  if (typeof value.id !== 'string' || !UUID_PATTERN.test(value.id)) {
    throw new TypeError('Invalid presentation ticket id');
  }
  const createdAt = parseBoundedText(value.created_at, 40, 'Invalid presentation ticket timestamp');
  if (!Number.isFinite(Date.parse(createdAt))) {
    throw new TypeError('Invalid presentation ticket timestamp');
  }
  return {
    id: value.id,
    subject: parseBoundedText(value.subject, 1000, 'Invalid presentation ticket subject'),
    status: parseBoundedText(value.status, 100, 'Invalid presentation ticket status'),
    issue_type: parseBoundedText(value.issue_type, 300, 'Invalid presentation ticket issue type'),
    created_at: createdAt,
  };
}

function parseTicketData(value: unknown): PresentationAiRequest['ticketData'] {
  assertPlainObject(value, 'Invalid presentation data');
  assertExactKeys(
    value,
    ['dateRange', 'summary', 'categories', 'topOrganizations'],
    'Invalid presentation data fields'
  );

  assertPlainObject(value.dateRange, 'Invalid presentation date range');
  assertExactKeys(value.dateRange, ['start', 'end'], 'Invalid presentation date range fields');
  const start = parseDate(value.dateRange.start);
  const end = parseDate(value.dateRange.end);
  const rangeDays = (end.timestamp - start.timestamp) / 86_400_000;
  if (rangeDays < 0 || rangeDays > MAX_DATE_RANGE_DAYS) {
    throw new TypeError('Invalid presentation date range');
  }

  assertPlainObject(value.summary, 'Invalid presentation summary');
  assertExactKeys(
    value.summary,
    ['totalTickets', 'resolvedTickets', 'resolvedRate', 'topHospital', 'topCategory'],
    'Invalid presentation summary fields'
  );
  const totalTickets = parseNumber(value.summary.totalTickets, 0, MAX_COUNT);
  const resolvedTickets = parseNumber(value.summary.resolvedTickets, 0, MAX_COUNT);
  if (resolvedTickets > totalTickets) throw new TypeError('Invalid presentation metric');

  if (!Array.isArray(value.categories) || value.categories.length > 100) {
    throw new TypeError('Invalid presentation categories');
  }
  const categories = value.categories.map(parseNamedCount);

  if (!Array.isArray(value.topOrganizations) || value.topOrganizations.length > 10) {
    throw new TypeError('Invalid presentation organizations');
  }
  const topOrganizations = value.topOrganizations.map((organization) => {
    assertPlainObject(organization, 'Invalid presentation organization');
    assertExactKeys(
      organization,
      ['name', 'totalTickets', 'resolvedTickets', 'tickets'],
      'Invalid presentation organization fields'
    );
    const organizationTotal = parseNumber(organization.totalTickets, 0, MAX_COUNT);
    const organizationResolved = parseNumber(organization.resolvedTickets, 0, MAX_COUNT);
    if (organizationResolved > organizationTotal) throw new TypeError('Invalid presentation metric');
    if (!Array.isArray(organization.tickets) || organization.tickets.length > 10) {
      throw new TypeError('Invalid presentation organization tickets');
    }
    return {
      name: parseBoundedText(organization.name, 300, 'Invalid presentation organization name'),
      totalTickets: organizationTotal,
      resolvedTickets: organizationResolved,
      tickets: organization.tickets.map(parsePresentationTicket),
    };
  });

  return {
    dateRange: { start: start.raw, end: end.raw },
    summary: {
      totalTickets,
      resolvedTickets,
      resolvedRate: parseNumber(value.summary.resolvedRate, 0, 100, false),
      topHospital: parseNamedCount(value.summary.topHospital),
      topCategory: parseNamedCount(value.summary.topCategory),
    },
    categories,
    topOrganizations,
  };
}

export function parsePresentationAiRequest(input: unknown): PresentationAiRequest {
  assertPlainObject(input, 'Invalid presentation AI request');
  assertExactKeys(input, ['ticketData', 'customPrompt'], 'Invalid presentation AI request fields');
  return {
    ticketData: parseTicketData(input.ticketData),
    customPrompt: parseBoundedText(input.customPrompt, 2000, 'Invalid presentation AI prompt'),
  };
}

export function parseGeneratedPresentationInsights(input: unknown): GeneratedPresentationInsights {
  assertPlainObject(input, 'Invalid generated presentation insights');
  assertExactKeys(
    input,
    ['executiveSummary', 'keyChallenges', 'actionItems', 'hospitalInsights'],
    'Invalid generated presentation insight fields'
  );
  if (!Array.isArray(input.keyChallenges) || input.keyChallenges.length < 1 || input.keyChallenges.length > 5) {
    throw new TypeError('Invalid generated presentation challenges');
  }
  if (!Array.isArray(input.actionItems) || input.actionItems.length < 1 || input.actionItems.length > 5) {
    throw new TypeError('Invalid generated presentation actions');
  }
  assertPlainObject(input.hospitalInsights, 'Invalid generated organization insights');
  const hospitalEntries = Object.entries(input.hospitalInsights);
  if (hospitalEntries.length > 10) throw new TypeError('Invalid generated organization insights');

  return {
    executiveSummary: parseBoundedText(
      input.executiveSummary,
      5000,
      'Invalid generated presentation summary'
    ),
    keyChallenges: input.keyChallenges.map((challenge) => {
      assertPlainObject(challenge, 'Invalid generated presentation challenge');
      assertExactKeys(
        challenge,
        ['title', 'description'],
        'Invalid generated presentation challenge fields'
      );
      return {
        title: parseBoundedText(challenge.title, 300, 'Invalid generated presentation challenge'),
        description: parseBoundedText(
          challenge.description,
          3000,
          'Invalid generated presentation challenge'
        ),
      };
    }),
    actionItems: input.actionItems.map((item) => {
      assertPlainObject(item, 'Invalid generated presentation action');
      assertExactKeys(
        item,
        ['action', 'owner', 'targetDate'],
        'Invalid generated presentation action fields'
      );
      const targetDate = parseDate(item.targetDate).raw;
      return {
        action: parseBoundedText(item.action, 3000, 'Invalid generated presentation action'),
        owner: parseBoundedText(item.owner, 300, 'Invalid generated presentation owner'),
        targetDate,
      };
    }),
    hospitalInsights: Object.fromEntries(
      hospitalEntries.map(([name, insight]) => {
        if (['__proto__', 'constructor', 'prototype'].includes(name)) {
          throw new TypeError('Invalid generated organization name');
        }
        return [
          parseBoundedText(name, 300, 'Invalid generated organization name'),
          parseBoundedText(insight, 3000, 'Invalid generated organization insight'),
        ];
      })
    ),
  };
}
