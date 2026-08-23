const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseInboxReadId(value: unknown, field: string) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new TypeError(`Invalid ${field}`);
  return value;
}

export function parseInboxListLimit(value: unknown, fallback = 20) {
  const limit = Number(value ?? fallback);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Invalid inbox page size');
  return limit;
}

export function parseInboxConversationListInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid inbox query');
  const input = value as Record<string, unknown>;
  const allowed = new Set(['status', 'pageSize', 'cursorLastMessageAt', 'cursorId']);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new TypeError('Invalid inbox query');
  const status = input.status;
  if (status !== undefined && status !== 'active' && status !== 'closed') throw new TypeError('Invalid inbox status');
  const pageSize = parseInboxListLimit(input.pageSize, 10);
  const hasCursorTime = typeof input.cursorLastMessageAt === 'string' && input.cursorLastMessageAt.length > 0;
  const hasCursorId = typeof input.cursorId === 'string' && input.cursorId.length > 0;
  if (hasCursorTime !== hasCursorId) throw new TypeError('Invalid inbox cursor');
  let cursorLastMessageAt: string | null = null;
  let cursorId: string | null = null;
  if (hasCursorTime && hasCursorId) {
    const timestamp = Date.parse(input.cursorLastMessageAt as string);
    if (!Number.isFinite(timestamp)) throw new TypeError('Invalid inbox cursor');
    cursorLastMessageAt = new Date(timestamp).toISOString();
    cursorId = parseInboxReadId(input.cursorId, 'inbox cursor');
  }
  return { status, pageSize, cursorLastMessageAt, cursorId } as const;
}

export function parseInboxMessagePageInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid inbox messages query');
  const input = value as Record<string, unknown>;
  const allowed = new Set(['conversationId', 'ticketId', 'limit', 'beforeCreatedAt']);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new TypeError('Invalid inbox messages query');
  const conversationId = parseInboxReadId(input.conversationId, 'conversation id');
  const ticketId = input.ticketId ? parseInboxReadId(input.ticketId, 'ticket id') : null;
  const limit = parseInboxListLimit(input.limit, 50);
  let beforeCreatedAt: string | null = null;
  if (input.beforeCreatedAt) {
    if (typeof input.beforeCreatedAt !== 'string') throw new TypeError('Invalid message cursor');
    const timestamp = Date.parse(input.beforeCreatedAt);
    if (!Number.isFinite(timestamp)) throw new TypeError('Invalid message cursor');
    beforeCreatedAt = new Date(timestamp).toISOString();
  }
  return { conversationId, ticketId, limit, beforeCreatedAt };
}
