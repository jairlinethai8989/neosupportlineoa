import { supabase } from '@/lib/supabase';
import {
  normalizeTicketWorkspaceCompanySettings,
  normalizeTicketWorkspaceConversations,
  normalizeTicketWorkspaceProfile,
  normalizeTicketWorkspaceTicket,
  normalizeTicketWorkspaceTickets,
} from '@/lib/tickets/normalizers';
import type {
  TicketWorkspaceCompanySettings,
  TicketWorkspaceConversation,
  TicketWorkspaceProfile,
  TicketWorkspaceTicket,
} from '@/types/tickets';

export const ticketWorkspaceConversationSelect = `
  id,
  customer_id,
  current_ticket_id,
  status,
  last_message_at
`;

export const ticketWorkspaceTicketSelect = `
  id,
  ticket_no,
  customer_id,
  subject,
  description,
  status,
  priority,
  created_at,
  module,
  issue_type,
  organizations!tickets_organization_id_fkey (id, name),
  customers!tickets_customer_id_fkey (id, display_name),
  assigned_agent:profiles!assigned_agent_id (id, display_name:full_name, theme_color)
`;

export const ticketWorkspaceTicketDetailSelect = `
  id,
  ticket_no,
  customer_id,
  subject,
  status,
  priority,
  created_at,
  module,
  issue_type,
  organization_id,
  current_department_id,
  organizations!tickets_organization_id_fkey (id, name),
  customers!tickets_customer_id_fkey (id, display_name),
  assigned_agent:profiles!assigned_agent_id (id, display_name:full_name, theme_color),
  department_data:departments!current_department_id (id, name)
`;

export const ticketWorkspaceProfileSelect = `
  id,
  role,
  permissions,
  resolution_templates
`;



export async function listTicketWorkspaceConversations(input?: {
  limit?: number;
  status?: 'active' | 'closed';
}): Promise<TicketWorkspaceConversation[]> {
  const limit = Math.max(1, Math.min(input?.limit || 100, 300));
  let query = supabase
    .from('conversations')
    .select(ticketWorkspaceConversationSelect)
    .order('last_message_at', { ascending: false })
    .limit(limit);

  if (input?.status === 'active') {
    query = query.or(
      'is_active.eq.true,status.eq.active,status.eq.open,status.eq.new,status.ilike.*progress*'
    );
  } else if (input?.status === 'closed') {
    query = query.in('status', ['closed', 'resolved', 'done']);
  }

  const { data, error } = await query;
  if (error) throw error;
  return normalizeTicketWorkspaceConversations(data || []);
}

export async function listTicketWorkspaceConversationsByTicketIds(
  ticketIds: string[],
  customerIds: string[] = []
): Promise<TicketWorkspaceConversation[]> {
  if (ticketIds.length === 0) return [];

  let query = supabase
    .from('conversations')
    .select(ticketWorkspaceConversationSelect);

  if (customerIds.length > 0) {
    const ticketIdsStr = ticketIds.join(',');
    const customerIdsStr = customerIds.join(',');
    query = query.or(`current_ticket_id.in.(${ticketIdsStr}),and(customer_id.in.(${customerIdsStr}),status.eq.active)`);
  } else {
    query = query.in('current_ticket_id', ticketIds);
  }

  const { data, error } = await query.order('last_message_at', { ascending: false });

  if (error) throw error;

  return normalizeTicketWorkspaceConversations(data || []);
}

export async function listTicketWorkspaceTickets(input: {
  fromIso?: string;
  toIso?: string;
  limit?: number;
  page?: number;
  searchTerm?: string;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  projectIds?: string[] | null;
}): Promise<TicketWorkspaceTicket[]> {
  if (Array.isArray(input.projectIds) && input.projectIds.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(input.limit || 50, 200));
  const page = Math.max(1, input.page || 1);
  const fromOffset = (page - 1) * limit;
  const toOffset = page * limit - 1;

  let query = supabase
    .from('tickets')
    .select(ticketWorkspaceTicketSelect);

  if (input.projectIds && input.projectIds.length > 0) {
    query = query.in('project_id', input.projectIds);
  }

  // Apply Search
  if (input.searchTerm && input.searchTerm.trim() !== '') {
    const term = input.searchTerm.trim();
    let searchFilter = `subject.ilike.%${term}%,description.ilike.%${term}%`;
    if (/^\d+$/.test(term)) {
      searchFilter += `,ticket_no.eq.${term}`;
    } else {
      searchFilter += `,ticket_no.ilike.%${term}%`;
    }
    query = query.or(searchFilter);
  }

  // Apply Date Filter & Persistent statuses
  if (input.fromIso && input.toIso) {
    const persistentStatuses = 'New,Assigned,In Progress,Escalated,Fix Completed,Pending';
    const filter = `and(created_at.gte.${input.fromIso},created_at.lte.${input.toIso}),status.in.(${persistentStatuses})`;
    query = query.or(filter);
  } else if (input.fromIso) {
    query = query.gte('created_at', input.fromIso);
  } else if (input.toIso) {
    query = query.lte('created_at', input.toIso);
  }

  // Apply Sorting
  if (input.sortKey) {
    let sortColumn = input.sortKey;
    if (input.sortKey === 'organization') sortColumn = 'organization_id';
    else if (input.sortKey === 'customer') sortColumn = 'customer_id';
    else if (input.sortKey === 'agent') sortColumn = 'assigned_agent_id';

    query = query.order(sortColumn, { ascending: input.sortDirection === 'asc' });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Order by ID as secondary to ensure stable sorting
  query = query.order('id', { ascending: false });

  // Apply Offset Pagination
  query = query.range(fromOffset, toOffset);

  const { data, error } = await query;
  if (error) throw error;
  return normalizeTicketWorkspaceTickets(data || []);
}

export async function getTicketWorkspaceCompanySettings(): Promise<TicketWorkspaceCompanySettings> {
  try {
    const [settingsRes, modulesRes, issuesRes] = await Promise.all([
      supabase.from('company_settings').select('id, resolution_templates').limit(1).maybeSingle(),
      supabase.from('ticket_modules').select('name').eq('is_active', true),
      supabase.from('ticket_issue_types').select('name').eq('is_active', true),
    ]);

    if (settingsRes.error) throw settingsRes.error;

    const data = settingsRes.data || {};
    const payload = {
      ...data,
      modules: modulesRes.data?.map((d) => d.name) || [],
      issue_types: issuesRes.data?.map((d) => d.name) || [],
    };

    return normalizeTicketWorkspaceCompanySettings(payload);
  } catch (error) {
    console.error('Failed to fetch ticket workspace company settings:', error);
    return {
      id: null,
      modules: [],
      resolution_templates: [],
      issue_types: [],
    };
  }
}

export async function getTicketWorkspaceProfile(
  userId: string
): Promise<TicketWorkspaceProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(ticketWorkspaceProfileSelect)
    .eq('id', userId)
    .single();

  if (error) throw error;
  return normalizeTicketWorkspaceProfile(data);
}

export async function getTicketWorkspaceConversationById(
  conversationId: string
): Promise<TicketWorkspaceConversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(ticketWorkspaceConversationSelect)
    .eq('id', conversationId)
    .single();

  if (error) throw error;
  const normalized = normalizeTicketWorkspaceConversations([data || {}]);
  return normalized[0] || null;
}

export async function getTicketWorkspaceTicketById(
  ticketId: string
): Promise<TicketWorkspaceTicket | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select(ticketWorkspaceTicketDetailSelect)
    .eq('id', ticketId)
    .single();

  if (error) throw error;
  return normalizeTicketWorkspaceTicket(data);
}

export async function getTicketWorkspaceUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  return user;
}

export async function updateTicketWorkspaceTemplates(
  companySettingsId: string,
  templates: string[]
) {
  const { error } = await supabase
    .from('company_settings')
    .update({ resolution_templates: templates })
    .eq('id', companySettingsId);

  if (error) throw error;
}

export function requireTicketWorkspaceTicket(ticket: unknown, context: string) {
  const normalized = normalizeTicketWorkspaceTicket(ticket);
  if (!normalized) {
    throw new Error(`Invalid ticket payload returned from ${context}`);
  }
  return normalized;
}
