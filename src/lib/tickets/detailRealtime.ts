import type { TicketDetailMessage } from '@/types/tickets';

export const ticketDetailMessageSelect = `
  id,
  content,
  sender_type,
  staff_id,
  ticket_id,
  conversation_id,
  message_type,
  created_at
`;

export function isMessageRelatedToThread(
  message: Pick<TicketDetailMessage, 'ticket_id' | 'conversation_id'>,
  ticketId: string,
  conversationId?: string | null
) {
  if (message.ticket_id === ticketId) return true;
  if (conversationId && message.conversation_id === conversationId) return true;
  return false;
}

export function appendMessageIfMissing(
  previousMessages: TicketDetailMessage[],
  incomingMessage: TicketDetailMessage
) {
  if (previousMessages.some((message) => message.id === incomingMessage.id)) {
    return previousMessages;
  }
  return [...previousMessages, incomingMessage];
}

export function replaceMessageById(
  previousMessages: TicketDetailMessage[],
  incomingMessage: TicketDetailMessage
) {
  return previousMessages.map((message) =>
    message.id === incomingMessage.id ? incomingMessage : message
  );
}

export function removeMessageById(
  previousMessages: TicketDetailMessage[],
  messageId: string
) {
  return previousMessages.filter((message) => message.id !== messageId);
}

