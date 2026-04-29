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
  status,
  priority,
  created_at,
  module,
  issue_type,
  hospitals!tickets_hospital_id_fkey (id, name),
  customers!tickets_customer_id_fkey (id, display_name),
  assigned_agent:profiles!assigned_agent_id (id, display_name:full_name)
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
  hospital_id,
  current_department_id,
  hospitals!tickets_hospital_id_fkey (id, name),
  customers!tickets_customer_id_fkey (id, display_name),
  assigned_agent:profiles!assigned_agent_id (id, display_name:full_name),
  department_data:departments!current_department_id (id, name)
`;

export const ticketWorkspaceProfileSelect = `
  role,
  permissions,
  resolution_templates
`;

export const ticketWorkspaceCompanySettingsSelect = `
  id,
  modules,
  resolution_templates,
  issue_types
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
      'status.ilike.active,status.ilike.open,status.ilike.new,status.ilike.in progress,status.ilike.in_progress,is_active.eq.true'
    );
  } else if (input?.status === 'closed') {
    query = query.in('status', ['closed', 'resolved', 'done']);
  }

  const { data, error } = await query;
  if (error) throw error;
  return normalizeTicketWorkspaceConversations(data || []);
}

export async function listTicketWorkspaceConversationsByTicketIds(
  ticketIds: string[]
): Promise<TicketWorkspaceConversation[]> {
  if (ticketIds.length === 0) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select(ticketWorkspaceConversationSelect)
    .in('current_ticket_id', ticketIds)
    .order('last_message_at', { ascending: false })
    .limit(Math.max(20, ticketIds.length * 2));

  if (error) throw error;
  return normalizeTicketWorkspaceConversations(data || []);
}

export async function listTicketWorkspaceTickets(input: {
  fromIso?: string;
  toIso?: string;
  limit?: number;
  cursorCreatedAt?: string;
  cursorId?: string;
}): Promise<TicketWorkspaceTicket[]> {
  const limit = Math.max(1, Math.min(input.limit || 120, 200));
  let query = supabase
    .from('tickets')
    .select(ticketWorkspaceTicketSelect)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (input.cursorCreatedAt && input.cursorId) {
    query = query.or(
      `created_at.lt.${input.cursorCreatedAt},and(created_at.eq.${input.cursorCreatedAt},id.lt.${input.cursorId})`
    );
  } else if (input.cursorCreatedAt) {
    query = query.lt('created_at', input.cursorCreatedAt);
  }

  if (input.fromIso && input.toIso) {
    // Persistent statuses that show regardless of date
    const persistentStatuses = 'Escalated,Pending';
    // Combine: (In date range) OR (Status is persistent)
    const filter = `and(created_at.gte.${input.fromIso},created_at.lte.${input.toIso}),status.in.(${persistentStatuses})`;
    query = query.or(filter);
  } else if (input.fromIso) {
    query = query.gte('created_at', input.fromIso);
  } else if (input.toIso) {
    query = query.lte('created_at', input.toIso);
  }

  const { data, error } = await query;
  if (error) throw error;
  return normalizeTicketWorkspaceTickets(data || []);
}

export async function getTicketWorkspaceCompanySettings(): Promise<TicketWorkspaceCompanySettings> {
  const { data, error } = await supabase
    .from('company_settings')
    .select(ticketWorkspaceCompanySettingsSelect)
    .limit(1)
    .single();

  if (error) throw error;
  return normalizeTicketWorkspaceCompanySettings(data);
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
