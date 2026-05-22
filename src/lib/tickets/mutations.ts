import { ticketService } from '@/lib/services/ticketService';
import { invalidateAllPreviewCaches } from '@/lib/reports/previewCache';
import { requireTicketWorkspaceTicket } from '@/lib/tickets/queries';
import type { TicketWorkspaceTicket } from '@/types/tickets';

export async function claimWorkspaceTicket(
  ticketId: string,
  agentId?: string
): Promise<{ ticket: TicketWorkspaceTicket; conversationId: string | null }> {
  const result = await ticketService.claimTicket(ticketId, agentId);
  invalidateAllPreviewCaches();
  const normalized = requireTicketWorkspaceTicket(result.ticket, 'claimWorkspaceTicket');
  return { ticket: normalized, conversationId: result.conversationId };
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
  invalidateAllPreviewCaches();
  return requireTicketWorkspaceTicket(ticket, 'resolveWorkspaceTicket');
}
