import type { TicketWorkspaceTicket } from '@/types/tickets';

export interface TicketWorkspaceToastInput {
  id: string;
  type: string;
  title: string;
  body: string;
}

export function getTicketWorkspaceErrorMessage(error: unknown, fallback = 'Unknown error') {
  return error instanceof Error ? error.message : fallback;
}

export function getTicketWorkspaceClaimViewOnlyMessage() {
  return 'You do not have permission to claim tickets (view-only access).';
}

export function getTicketWorkspaceLoginRequiredMessage() {
  return 'Please sign in before performing this action.';
}

export function getTicketWorkspaceActiveConversationMessage() {
  return 'Cannot resolve this ticket while an active conversation is still open.';
}

export function getTicketWorkspaceClaimViewOnlyToast(): TicketWorkspaceToastInput {
  return {
    id: 'claim-view-only',
    type: 'ticket',
    title: 'Permission denied',
    body: getTicketWorkspaceClaimViewOnlyMessage(),
  };
}

export function getTicketWorkspaceLoginRequiredToast(): TicketWorkspaceToastInput {
  return {
    id: 'login-required',
    type: 'ticket',
    title: 'Authentication required',
    body: getTicketWorkspaceLoginRequiredMessage(),
  };
}

export function getTicketWorkspaceActiveConversationToast(): TicketWorkspaceToastInput {
  return {
    id: 'resolve-active-conversation',
    type: 'ticket',
    title: 'Cannot resolve yet',
    body: getTicketWorkspaceActiveConversationMessage(),
  };
}

export function getTicketWorkspaceClaimSuccessToast(ticketId: string): TicketWorkspaceToastInput {
  return {
    id: `claim-${ticketId}`,
    type: 'ticket',
    title: 'Ticket claimed',
    body: 'You successfully claimed this ticket.',
  };
}

export function getTicketWorkspaceClaimFailToast(error: unknown): TicketWorkspaceToastInput {
  return {
    id: 'claim-fail',
    type: 'ticket',
    title: 'Unable to claim ticket',
    body: getTicketWorkspaceErrorMessage(error),
  };
}

export function getTicketWorkspaceResolveSuccessToast(
  ticket: TicketWorkspaceTicket | null
): TicketWorkspaceToastInput {
  return {
    id: `resolve-${ticket?.id || 'unknown'}`,
    type: 'ticket',
    title: 'Ticket resolved',
    body: `Ticket #${ticket?.ticket_no || ''} was resolved successfully.`,
  };
}

export function getTicketWorkspaceResolveFailToast(error: unknown): TicketWorkspaceToastInput {
  return {
    id: 'resolve-fail',
    type: 'ticket',
    title: 'Unable to resolve ticket',
    body: getTicketWorkspaceErrorMessage(error),
  };
}
