import type {
  InboxAgent,
  InboxCompanySettings,
  InboxConversation,
  InboxCustomer,
  InboxMessage,
  InboxTicket,
} from '@/types/inbox';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asPermissions(value: unknown): Partial<Record<string, string>> | null {
  if (!isRecord(value)) return null;

  return Object.fromEntries(
    Object.entries(value).filter(([, permission]) => typeof permission === 'string')
  ) as Partial<Record<string, string>>;
}

export function normalizeInboxCustomer(value: unknown): InboxCustomer | null {
  if (!isRecord(value)) return null;

  return {
    id: asString(value.id) || '',
    display_name: asString(value.display_name),
    line_user_id: asString(value.line_user_id),
    avatar_url: asString(value.avatar_url),
  };
}

export function normalizeInboxConversation(value: unknown): InboxConversation | null {
  if (!isRecord(value)) return null;

  return {
    id: asString(value.id) || '',
    status: asString(value.status),
    last_message_at: asString(value.last_message_at),
    customer_id: asString(value.customer_id),
    current_ticket_id: asString(value.current_ticket_id),
    is_active: asBoolean(value.is_active),
    customers: normalizeInboxCustomer(value.customers),
    ticket_data: isRecord(value.ticket_data) ? {
      id: asString(value.ticket_data.id) || '',
      ticket_no: asString(value.ticket_data.ticket_no),
      subject: asString(value.ticket_data.subject),
    } : null,
  };
}

export function normalizeInboxConversations(values: unknown[]): InboxConversation[] {
  return values
    .map((value) => normalizeInboxConversation(value))
    .filter((value): value is InboxConversation => Boolean(value?.id));
}

export function normalizeInboxMessage(value: unknown): InboxMessage | null {
  if (!isRecord(value)) return null;

  return {
    id: asString(value.id) || '',
    content: asString(value.content),
    sender_type: asString(value.sender_type),
    staff_id: asString(value.staff_id),
    conversation_id: asString(value.conversation_id) || '',
    ticket_id: asString(value.ticket_id),
    message_type: asString(value.message_type),
    created_at: asString(value.created_at) || new Date(0).toISOString(),
  };
}

export function normalizeInboxMessages(values: unknown[]): InboxMessage[] {
  return values
    .map((value) => normalizeInboxMessage(value))
    .filter((value): value is InboxMessage => Boolean(value?.id && value.conversation_id));
}

export function normalizeInboxTicket(value: unknown): InboxTicket | null {
  if (!isRecord(value)) return null;

  return {
    id: asString(value.id) || '',
    ticket_no: asString(value.ticket_no),
    customer_id: asString(value.customer_id),
    subject: asString(value.subject),
    description: asString(value.description),
    status: asString(value.status),
    assigned_agent_id: asString(value.assigned_agent_id),
    module: asString(value.module),
    issue_type: asString(value.issue_type),
  };
}

export function normalizeInboxAgent(value: unknown, fallbackId?: string): InboxAgent | null {
  if (!isRecord(value)) {
    return fallbackId ? { id: fallbackId } : null;
  }

  const id = asString(value.id) || fallbackId || '';
  if (!id) return null;

  return {
    id,
    role: asString(value.role),
    permissions: asPermissions(value.permissions),
    quick_replies: asStringArray(value.quick_replies),
    resolution_templates: asStringArray(value.resolution_templates),
  };
}

export function normalizeInboxCompanySettings(value: unknown): InboxCompanySettings {
  if (!isRecord(value)) {
    return { modules: [], issue_types: [] };
  }

  return {
    modules: asStringArray(value.modules),
    issue_types: asStringArray(value.issue_types),
  };
}
