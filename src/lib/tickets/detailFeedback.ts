import type { ToastNotif } from '@/hooks/useNotifications';

type TicketDetailAction =
  | 'send message'
  | 'upload file'
  | 'capture image'
  | 'save edited image'
  | 'delete message'
  | 'end chat'
  | 'resolve ticket'
  | 'update ticket';

function getTicketDetailErrorMessage(error: unknown, fallback = 'Unknown error') {
  return error instanceof Error ? error.message : fallback;
}

export function getTicketDetailActionFailedToast(
  action: TicketDetailAction,
  error: unknown
): ToastNotif {
  return {
    id: `ticket-detail-fail-${action}-${Date.now()}`,
    type: 'ticket',
    title: `Unable to ${action}`,
    body: getTicketDetailErrorMessage(error),
  };
}

export function getTicketDetailChatMustEndToast(): ToastNotif {
  return {
    id: `ticket-detail-chat-active-${Date.now()}`,
    type: 'ticket',
    title: 'Cannot resolve yet',
    body: 'Please end the active chat session before resolving this ticket.',
  };
}

export function getTicketDetailValidationToast(): ToastNotif {
  return {
    id: `ticket-detail-validation-${Date.now()}`,
    type: 'ticket',
    title: 'Missing required fields',
    body: 'Please provide module, issue type, and resolution summary before resolving.',
  };
}

export function getTicketDetailDeleteConfirmMessage() {
  return 'Do you want to unsend this message?';
}

export function getTicketDetailEndChatConfirmMessage() {
  return 'Do you want to end this chat session?';
}

export function confirmTicketDetailDeleteMessage() {
  return window.confirm(getTicketDetailDeleteConfirmMessage());
}

export function confirmTicketDetailEndChat() {
  return window.confirm(getTicketDetailEndChatConfirmMessage());
}

export function getTicketDetailResolvedToast(ticketNo: string | null | undefined): ToastNotif {
  return {
    id: `ticket-detail-resolved-${ticketNo || 'unknown'}-${Date.now()}`,
    type: 'ticket',
    title: 'Ticket resolved',
    body: `Ticket #${ticketNo || ''} was resolved successfully.`,
  };
}

export function getTicketDetailSystemResolveMessage(
  resolutionSummary: string,
  moduleName: string,
  surveyLink: string
) {
  return `[SYSTEM] Resolution completed: ${resolutionSummary}\nModule: ${moduleName}\nSurvey: ${surveyLink}`;
}
