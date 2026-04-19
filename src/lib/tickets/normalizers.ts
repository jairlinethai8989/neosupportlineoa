import type {
  TicketWorkspaceAssignedAgent,
  TicketWorkspaceCompanySettings,
  TicketWorkspaceConversation,
  TicketWorkspaceCustomer,
  TicketWorkspaceHospital,
  TicketWorkspaceProfile,
  TicketWorkspaceTicket,
} from '@/types/tickets';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
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

function normalizeHospital(value: unknown): TicketWorkspaceHospital | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id) || '',
    name: asString(value.name),
  };
}

function normalizeCustomer(value: unknown): TicketWorkspaceCustomer | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id) || '',
    display_name: asString(value.display_name),
  };
}

function normalizeAssignedAgent(value: unknown): TicketWorkspaceAssignedAgent | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id) || '',
    display_name: asString(value.display_name),
  };
}

export function normalizeTicketWorkspaceConversation(
  value: unknown
): TicketWorkspaceConversation | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id) || '',
    customer_id: asString(value.customer_id),
    current_ticket_id: asString(value.current_ticket_id),
    status: asString(value.status),
  };
}

export function normalizeTicketWorkspaceConversations(
  values: unknown[]
): TicketWorkspaceConversation[] {
  return values
    .map((value) => normalizeTicketWorkspaceConversation(value))
    .filter((value): value is TicketWorkspaceConversation => Boolean(value?.id));
}

export function normalizeTicketWorkspaceTicket(value: unknown): TicketWorkspaceTicket | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id) || '',
    ticket_no: asString(value.ticket_no),
    customer_id: asString(value.customer_id),
    subject: asString(value.subject),
    status: asString(value.status),
    priority: asString(value.priority),
    created_at: asString(value.created_at),
    module: asString(value.module),
    issue_type: asString(value.issue_type),
    hospitals: normalizeHospital(value.hospitals),
    customers: normalizeCustomer(value.customers),
    assigned_agent: normalizeAssignedAgent(value.assigned_agent),
    department_data: value.department_data as any,
    current_department_id: asString(value.current_department_id),
    hospital_id: asString(value.hospital_id),
  };
}

export function normalizeTicketWorkspaceTickets(values: unknown[]): TicketWorkspaceTicket[] {
  return values
    .map((value) => normalizeTicketWorkspaceTicket(value))
    .filter((value): value is TicketWorkspaceTicket => Boolean(value?.id));
}

export function normalizeTicketWorkspaceProfile(value: unknown): TicketWorkspaceProfile | null {
  if (!isRecord(value)) return null;
  return {
    role: asString(value.role),
    permissions: asPermissions(value.permissions),
    resolution_templates: asStringArray(value.resolution_templates),
  };
}

export function normalizeTicketWorkspaceCompanySettings(
  value: unknown
): TicketWorkspaceCompanySettings {
  if (!isRecord(value)) {
    return {
      id: null,
      modules: [],
      resolution_templates: [],
      issue_types: [],
    };
  }

  return {
    id: asString(value.id),
    modules: asStringArray(value.modules),
    resolution_templates: asStringArray(value.resolution_templates),
    issue_types: asStringArray(value.issue_types),
  };
}
