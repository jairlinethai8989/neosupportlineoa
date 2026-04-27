import type { TicketDetailTicket, TicketDetailUser } from '@/types/tickets';

function normalizeStatus(status: string | null | undefined) {
  return String(status || '').trim().toLowerCase();
}

export function isResolvedOrClosedStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return normalized === 'resolved' || normalized === 'closed';
}

export function isNewStatus(status: string | null | undefined) {
  return normalizeStatus(status) === 'new';
}

export function isActiveConversationStatus(status: string | null | undefined) {
  return normalizeStatus(status) === 'active';
}

export function isTicketOwnerOrAdmin(
  ticket: Pick<TicketDetailTicket, 'assigned_agent_id'> | null | undefined,
  user: Pick<TicketDetailUser, 'id' | 'role'> | null | undefined
) {
  if (!ticket || !user) return false;
  if (user.role === 'Administrator') return true;
  return Boolean(ticket.assigned_agent_id) && ticket.assigned_agent_id === user.id;
}

export function isAssignedToOtherAgent(
  ticket: Pick<TicketDetailTicket, 'assigned_agent_id'> | null | undefined,
  user: Pick<TicketDetailUser, 'id' | 'role'> | null | undefined
) {
  if (!ticket?.assigned_agent_id) return false;
  if (user?.role === 'Administrator') return false;
  return ticket.assigned_agent_id !== user?.id;
}

export function canResolveTicket(
  status: string | null | undefined,
  isOwnerOrAdmin: boolean,
  isChatActive: boolean
) {
  return !isResolvedOrClosedStatus(status) && !isNewStatus(status) && isOwnerOrAdmin && !isChatActive;
}

