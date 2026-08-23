'use server';

import { hasStaffAccess, requireStaffAuth } from '@/lib/auth/staffAuthorization';
import { parseNotificationActivityCursor } from '@/lib/notifications/activitySecurity';
import { getTicketLogVisibilityFilter } from '@/lib/notifications/ticketLogSecurity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function getTicketLogNotificationsAction() {
  const { user, profile } = await requireStaffAuth();
  let query = supabaseAdmin.from('ticket_logs')
    .select('id, ticket_id, action_type, to_user_id, performer_id, note, created_at, tickets(ticket_no, subject)')
    .order('created_at', { ascending: false })
    .limit(30);
  const visibilityFilter = getTicketLogVisibilityFilter(profile.role, user.id);
  if (visibilityFilter) query = query.or(visibilityFilter);
  const { data, error } = await query;
  if (error) throw new Error('Failed to load ticket notifications');
  return (data || []).map((row) => ({
    ...row,
    tickets: Array.isArray(row.tickets) ? row.tickets[0] || null : row.tickets || null,
  }));
}

export async function getNewTicketCountAction() {
  await requireStaffAuth();
  const { count, error } = await supabaseAdmin
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .ilike('status', 'new');
  if (error) throw new Error('Failed to load new ticket count');
  return count || 0;
}

export async function getActiveInboxCountAction() {
  await requireStaffAuth();
  const { count, error } = await supabaseAdmin
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');
  if (error) throw new Error('Failed to load inbox count');
  return count || 0;
}

export async function getSlaNotificationTicketsAction() {
  await requireStaffAuth();
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select('id, ticket_no, subject, sla_due_at, status, priority')
    .lt('sla_due_at', twoHoursFromNow)
    .not('status', 'in', '("Resolved","Closed")')
    .order('sla_due_at', { ascending: true })
    .limit(20);
  if (error) throw new Error('Failed to load SLA notifications');
  return data || [];
}

export async function getNotificationActivityAction(cursorValue: unknown) {
  const { user, profile } = await requireStaffAuth();
  const cursor = parseNotificationActivityCursor(cursorValue);
  const serverTime = new Date().toISOString();
  const canViewTickets = hasStaffAccess(profile, { permission: 'tickets', level: 'view' });
  const canViewInbox = hasStaffAccess(profile, { permission: 'inbox', level: 'view' });

  const ticketsPromise = canViewTickets
    ? supabaseAdmin.from('tickets')
      .select('id, ticket_no, subject, status, created_at, updated_at')
      .gt('updated_at', cursor).lte('updated_at', serverTime)
      .order('updated_at', { ascending: true }).limit(100)
    : Promise.resolve({ data: [], error: null });
  const logsPromise = (async () => {
    if (!canViewTickets) return { data: [], error: null };
    let query = supabaseAdmin.from('ticket_logs')
      .select('id, ticket_id, created_at')
      .gt('created_at', cursor).lte('created_at', serverTime)
      .order('created_at', { ascending: true }).limit(100);
    const visibilityFilter = getTicketLogVisibilityFilter(profile.role, user.id);
    if (visibilityFilter) query = query.or(visibilityFilter);
    return query;
  })();
  const messagesPromise = canViewInbox
    ? supabaseAdmin.from('messages')
      .select('id, content, conversation_id, created_at')
      .eq('sender_type', 'customer').neq('message_type', 'system')
      .gt('created_at', cursor).lte('created_at', serverTime)
      .order('created_at', { ascending: true }).limit(100)
    : Promise.resolve({ data: [], error: null });
  const conversationsPromise = canViewInbox
    ? supabaseAdmin.from('conversations')
      .select('id, updated_at')
      .gt('updated_at', cursor).lte('updated_at', serverTime)
      .order('updated_at', { ascending: true }).limit(100)
    : Promise.resolve({ data: [], error: null });

  const [tickets, logs, messages, conversations] = await Promise.all([
    ticketsPromise,
    logsPromise,
    messagesPromise,
    conversationsPromise,
  ]);
  if (tickets.error || logs.error || messages.error || conversations.error) {
    throw new Error('Failed to load notification activity');
  }

  return {
    serverTime,
    tickets: tickets.data || [],
    ticketLogs: logs.data || [],
    messages: messages.data || [],
    conversations: conversations.data || [],
  };
}
