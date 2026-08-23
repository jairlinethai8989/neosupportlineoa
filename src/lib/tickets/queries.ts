import {
  normalizeTicketWorkspaceTicket,
} from '@/lib/tickets/normalizers';

export function requireTicketWorkspaceTicket(ticket: unknown, context: string) {
  const normalized = normalizeTicketWorkspaceTicket(ticket);
  if (!normalized) {
    throw new Error(`Invalid ticket payload returned from ${context}`);
  }
  return normalized;
}
