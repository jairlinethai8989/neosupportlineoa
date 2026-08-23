const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITIES = new Set(['Critical', 'High', 'Medium', 'Low']);

export function parseTicketDetailId(value: unknown) {
  const id = String(value ?? '').trim();
  if (!UUID_PATTERN.test(id)) throw new Error('Invalid ticket ID');
  return id;
}

export function parseTicketDetailFieldUpdate(fieldValue: unknown, rawValue: unknown) {
  const field = String(fieldValue ?? '');
  const value = String(rawValue ?? '').trim();
  if (field === 'priority' && PRIORITIES.has(value)) return { field: 'priority', value } as const;
  if (field === 'department' && UUID_PATTERN.test(value)) {
    return { field: 'current_department_id', value } as const;
  }
  if (field === 'module' && value.length >= 1 && value.length <= 120) {
    return { field: 'module', value } as const;
  }
  throw new Error('Invalid ticket field update');
}

export function parseTicketDetailMessage(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid ticket message');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['conversationId', 'content'].includes(key))) {
    throw new Error('Invalid ticket message');
  }
  const content = String(input.content ?? '').trim();
  if (content.length < 1 || content.length > 10_000) throw new Error('Invalid ticket message');

  if (input.conversationId === undefined || input.conversationId === null || input.conversationId === '') {
    return { conversationId: null, content };
  }
  const conversationId = String(input.conversationId).trim();
  if (!UUID_PATTERN.test(conversationId)) throw new Error('Invalid ticket message');
  return { conversationId, content };
}

export function parseTicketDetailAttachmentReference(value: unknown, staffId: string, ticketId: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid ticket attachment');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['conversationId', 'path'].includes(key))) {
    throw new Error('Invalid ticket attachment');
  }
  const path = String(input.path ?? '').trim();
  const escapedStaffId = staffId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedTicketId = ticketId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^staff/${escapedStaffId}/tickets/${escapedTicketId}/[0-9a-f-]{36}\\.(?:jpe?g|png|webp|gif|mp4|webm|mov|pdf|docx?|xlsx?)$`, 'i');
  if (!pattern.test(path)) throw new Error('Invalid ticket attachment');

  if (input.conversationId === undefined || input.conversationId === null || input.conversationId === '') {
    return { path, conversationId: null };
  }
  const conversationId = String(input.conversationId).trim();
  if (!UUID_PATTERN.test(conversationId)) throw new Error('Invalid ticket attachment');
  return { path, conversationId };
}
