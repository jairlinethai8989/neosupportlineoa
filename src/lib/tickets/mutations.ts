import { ticketService } from '@/lib/services/ticketService';
import { requireTicketWorkspaceTicket } from '@/lib/tickets/queries';
import type { TicketWorkspaceTicket } from '@/types/tickets';

export async function claimWorkspaceTicket(
  ticketId: string,
  agentId?: string
): Promise<TicketWorkspaceTicket> {
  const ticket = await ticketService.claimTicket(ticketId, agentId);
  return requireTicketWorkspaceTicket(ticket, 'claimWorkspaceTicket');
}

export async function resolveWorkspaceTicket(input: {
  ticketId: string;
  agentId?: string;
  resolutionSummary: string;
  module?: string;
  issueType?: string;
}): Promise<TicketWorkspaceTicket> {
  const ticket = await ticketService.resolve(
    input.ticketId,
    input.agentId,
    input.resolutionSummary,
    input.module,
    input.issueType
  );
  return requireTicketWorkspaceTicket(ticket, 'resolveWorkspaceTicket');
}
