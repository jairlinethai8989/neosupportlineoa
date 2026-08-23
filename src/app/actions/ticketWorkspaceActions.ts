'use server';

import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  normalizeTicketWorkspaceConversations,
  normalizeTicketWorkspaceTicket,
  normalizeTicketWorkspaceTickets,
} from '@/lib/tickets/normalizers';
import {
  parseTicketWorkspaceId,
  parseTicketWorkspaceListInput,
} from '@/lib/tickets/ticketWorkspaceSecurity';

const CONVERSATION_SELECT = 'id, customer_id, current_ticket_id, status';
const TICKET_SELECT = `
  id, ticket_no, customer_id, subject, description, status, priority, created_at, module, issue_type,
  organizations!tickets_organization_id_fkey(id, name),
  customers!tickets_customer_id_fkey(id, display_name),
  assigned_agent:profiles!assigned_agent_id(id, display_name:full_name, theme_color)
`;
const TICKET_DETAIL_SELECT = `
  id, ticket_no, customer_id, subject, status, priority, created_at, module, issue_type,
  organization_id, current_department_id,
  organizations!tickets_organization_id_fkey(id, name),
  customers!tickets_customer_id_fkey(id, display_name),
  assigned_agent:profiles!assigned_agent_id(id, display_name:full_name, theme_color),
  department_data:departments!current_department_id(id, name)
`;

export async function getTicketWorkspacePageAction(value: unknown) {
  await requireStaffAuth({ permission: 'tickets', level: 'view' });
  const input = parseTicketWorkspaceListInput(value);
  const fromOffset = (input.page - 1) * input.limit;
  const toOffset = input.page * input.limit - 1;
  let query = supabaseAdmin.from('tickets').select(TICKET_SELECT);

  if (input.searchTerm) {
    const pattern = `%${input.searchTerm}%`;
    const clauses = [`subject.ilike.${pattern}`, `description.ilike.${pattern}`];
    clauses.push(/^\d+$/.test(input.searchTerm)
      ? `ticket_no.eq.${input.searchTerm}`
      : `ticket_no.ilike.${pattern}`);
    query = query.or(clauses.join(','));
  }

  const persistentStatuses = 'New,Assigned,In Progress,Escalated,Fix Completed,Pending';
  query = query.or(
    `and(created_at.gte.${input.fromIso},created_at.lte.${input.toIso}),status.in.(${persistentStatuses})`
  );
  const sortColumns: Record<string, string> = {
    organization: 'organization_id',
    customer: 'customer_id',
    agent: 'assigned_agent_id',
  };
  query = query
    .order(sortColumns[input.sortKey] || input.sortKey, { ascending: input.sortDirection === 'asc' })
    .order('id', { ascending: false })
    .range(fromOffset, toOffset);

  const { data, error } = await query;
  if (error) throw new Error('Failed to load ticket workspace');
  const tickets = normalizeTicketWorkspaceTickets(data || []);
  const ticketIds = tickets.map((ticket) => ticket.id);
  const customerIds = tickets.map((ticket) => ticket.customer_id).filter((id): id is string => Boolean(id));
  if (ticketIds.length === 0) return { tickets, conversations: [] };

  const ticketList = ticketIds.join(',');
  const customerList = customerIds.join(',');
  let conversationQuery = supabaseAdmin.from('conversations').select(CONVERSATION_SELECT);
  conversationQuery = customerIds.length > 0
    ? conversationQuery.or(`current_ticket_id.in.(${ticketList}),and(customer_id.in.(${customerList}),status.eq.active)`)
    : conversationQuery.in('current_ticket_id', ticketIds);
  const conversations = await conversationQuery.order('last_message_at', { ascending: false });
  if (conversations.error) throw new Error('Failed to load ticket workspace');
  return {
    tickets,
    conversations: normalizeTicketWorkspaceConversations(conversations.data || []),
  };
}

export async function getTicketWorkspaceTicketByIdAction(value: unknown) {
  await requireStaffAuth({ permission: 'tickets', level: 'view' });
  const ticketId = parseTicketWorkspaceId(value);
  const { data, error } = await supabaseAdmin.from('tickets')
    .select(TICKET_DETAIL_SELECT).eq('id', ticketId).maybeSingle();
  if (error) throw new Error('Failed to load ticket');
  return data ? normalizeTicketWorkspaceTicket(data) : null;
}

export async function getTicketWorkspaceIdentityAction() {
  const { user } = await requireStaffAuth({ permission: 'tickets', level: 'view' });
  return { id: user.id };
}
