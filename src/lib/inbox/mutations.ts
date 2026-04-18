import {
  closeConversationAction,
  deleteMessageAction,
  sendAgentMessageAction,
  sendSystemMessageAction,
} from '@/app/actions/messageActions';
import { ticketService } from '@/lib/services/ticketService';
import { supabase } from '@/lib/supabase';
import { normalizeInboxTicket } from '@/lib/inbox/normalizers';
import type { InboxTicket } from '@/types/inbox';

export interface InboxDeleteMessageResult {
  success: boolean;
  error?: string;
}

export interface ResolveInboxTicketInput {
  ticketId: string;
  agentId?: string;
  resolutionSummary: string;
  module?: string;
  issueType?: string;
}

function requireNormalizedTicket(ticket: unknown, context: string): InboxTicket {
  const normalizedTicket = normalizeInboxTicket(ticket);
  if (!normalizedTicket) {
    throw new Error(`Invalid ticket payload returned from ${context}`);
  }
  return normalizedTicket;
}

export async function sendInboxAgentMessage(input: {
  conversationId: string;
  ticketId: string | null;
  content: string;
  messageType?: string;
}) {
  return sendAgentMessageAction(
    input.conversationId,
    input.ticketId,
    input.content,
    input.messageType || 'text'
  );
}

export async function sendInboxSystemMessage(conversationId: string, content: string) {
  return sendSystemMessageAction(conversationId, content);
}

export async function closeInboxConversation(conversationId: string) {
  return closeConversationAction(conversationId);
}

export async function deleteInboxMessage(messageId: string): Promise<InboxDeleteMessageResult> {
  return deleteMessageAction(messageId);
}

export async function claimInboxTicket(ticketId: string, agentId?: string): Promise<InboxTicket> {
  const ticket = await ticketService.claimTicket(ticketId, agentId);
  return requireNormalizedTicket(ticket, 'claimInboxTicket');
}

export async function resolveInboxTicket(input: ResolveInboxTicketInput): Promise<InboxTicket> {
  const ticket = await ticketService.resolve(
    input.ticketId,
    input.agentId,
    input.resolutionSummary,
    input.module,
    input.issueType
  );
  return requireNormalizedTicket(ticket, 'resolveInboxTicket');
}

export async function linkConversationToTicket(conversationId: string, ticketId: string) {
  const { error } = await supabase
    .from('conversations')
    .update({ current_ticket_id: ticketId })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function uploadInboxChatMedia(input: {
  blob: Blob;
  conversationId: string;
  ticketId: string | null;
  filePrefix?: string;
}) {
  const fileName = `${input.filePrefix || 'edited_inbox'}_${input.conversationId}_${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('chat_media')
    .upload(fileName, input.blob, { contentType: 'image/jpeg' });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from('chat_media').getPublicUrl(fileName);

  await sendInboxAgentMessage({
    conversationId: input.conversationId,
    ticketId: input.ticketId,
    content: publicUrl,
    messageType: 'image',
  });

  return publicUrl;
}
