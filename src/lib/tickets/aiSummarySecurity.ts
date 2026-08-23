import { sanitizeExternalAiContextText } from '@/lib/ai/externalAiSecurity';

export type TicketAiSummary = {
  rootCause: string;
  resolution: string;
  preventiveRecommendations: string[];
};

const UNSAFE_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseTicketAiSummaryId(value: unknown) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new TypeError('Invalid ticket id');
  }
  return value;
}

export function buildBoundedTicketChatLog(input: unknown) {
  if (!Array.isArray(input) || input.length === 0) return '(ไม่มีประวัติการแชท)';

  const lines: string[] = [];
  let totalLength = 0;
  const recentMessages = input.slice(-200);
  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const message = recentMessages[index];
    if (!message || typeof message !== 'object' || Array.isArray(message)) continue;
    const row = message as Record<string, unknown>;
    if (typeof row.content !== 'string') continue;
    const content = row.content.replace(UNSAFE_CONTROL_PATTERN, ' ').trim().slice(0, 4000);
    if (!content) continue;
    const sender = row.sender_type === 'staff' ? 'Staff' : 'Customer';
    const line = `[${sender}]: ${content}`;
    const separatorLength = lines.length > 0 ? 1 : 0;
    if (totalLength + separatorLength + line.length > 40_000) break;
    lines.unshift(line);
    totalLength += separatorLength + line.length;
  }

  return lines.length > 0 ? lines.join('\n') : '(ไม่มีประวัติการแชท)';
}

export function sanitizeTicketAiContextText(value: unknown, maxLength: number) {
  return sanitizeExternalAiContextText(value, maxLength);
}

function parseText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') throw new TypeError('Invalid ticket AI summary text');
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || UNSAFE_CONTROL_PATTERN.test(normalized)) {
    throw new TypeError('Invalid ticket AI summary text');
  }
  return normalized;
}

export function parseGeneratedTicketAiSummary(input: unknown): TicketAiSummary {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Invalid ticket AI summary');
  }
  const candidate = input as Record<string, unknown>;
  const expectedKeys = new Set(['rootCause', 'resolution', 'preventiveRecommendations']);
  const actualKeys = Object.keys(candidate);
  if (actualKeys.length !== expectedKeys.size || actualKeys.some((key) => !expectedKeys.has(key))) {
    throw new TypeError('Invalid ticket AI summary fields');
  }
  if (
    !Array.isArray(candidate.preventiveRecommendations) ||
    candidate.preventiveRecommendations.length < 1 ||
    candidate.preventiveRecommendations.length > 5
  ) {
    throw new TypeError('Invalid ticket AI summary recommendations');
  }
  return {
    rootCause: parseText(candidate.rootCause, 5000),
    resolution: parseText(candidate.resolution, 5000),
    preventiveRecommendations: candidate.preventiveRecommendations.map((item) => parseText(item, 1000)),
  };
}
