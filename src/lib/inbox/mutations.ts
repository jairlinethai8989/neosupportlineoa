import {
  closeConversationAction,
  deleteMessageAction,
} from '@/app/actions/messageActions';
import { ticketService } from '@/lib/services/ticketService';
import { supabase } from '@/lib/supabase';
import { normalizeInboxTicket } from '@/lib/inbox/normalizers';
import { invalidateAllPreviewCaches } from '@/lib/reports/previewCache';
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
  mediaMimeType?: string;
}) {
  const messageType = input.messageType || 'text';
  const { error: insertError } = await supabase.from('messages').insert([
    {
      conversation_id: input.conversationId,
      ticket_id: input.ticketId,
      sender_type: 'agent',
      content: messageType === 'text' ? input.content : `[${messageType.toUpperCase()} Attachment]`,
      message_type: messageType,
      media_path: messageType !== 'text' ? input.content : null,
      media_mime_type: input.mediaMimeType || null,
    },
  ]);

  if (insertError) {
    const detailSuffix = [
      insertError.code ? `code=${insertError.code}` : null,
      insertError.details || null,
      insertError.hint || null,
    ]
      .filter(Boolean)
      .join(' | ');
    throw new Error(
      detailSuffix ? `${insertError.message} (${detailSuffix})` : insertError.message
    );
  }

  const { error: updateError } = await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', input.conversationId);

  if (updateError) {
    // Do not fail send flow when metadata timestamp update is blocked (e.g., RLS).
    console.warn('Inbox: last_message_at update skipped:', updateError);
  }
  invalidateAllPreviewCaches();
  return { success: true as const };
}

export async function sendInboxSystemMessage(conversationId: string, content: string) {
  const { error } = await supabase.from('messages').insert([
    {
      conversation_id: conversationId,
      sender_type: 'system',
      content,
      message_type: 'text',
    },
  ]);
  if (error) {
    const detailSuffix = [error.code ? `code=${error.code}` : null, error.details || null, error.hint || null]
      .filter(Boolean)
      .join(' | ');
    throw new Error(detailSuffix ? `${error.message} (${detailSuffix})` : error.message);
  }
  invalidateAllPreviewCaches();
  return { success: true as const };
}

export async function closeInboxConversation(conversationId: string) {
  const result = await closeConversationAction(conversationId);
  invalidateAllPreviewCaches();
  return result;
}

export async function deleteInboxMessage(messageId: string): Promise<InboxDeleteMessageResult> {
  return deleteMessageAction(messageId);
}

export async function claimInboxTicket(ticketId: string, agentId?: string): Promise<InboxTicket> {
  const ticket = await ticketService.claimTicket(ticketId, agentId);
  invalidateAllPreviewCaches();
  return requireNormalizedTicket(ticket, 'claimInboxTicket');
}

export async function resolveInboxTicket(input: ResolveInboxTicketInput & { conversationId?: string; surveyLink?: string }): Promise<InboxTicket> {
  const ticket = await ticketService.resolve(
    input.ticketId,
    input.agentId,
    input.resolutionSummary,
    input.module,
    input.issueType,
    input.conversationId,
    input.surveyLink
  );
  invalidateAllPreviewCaches();
  return requireNormalizedTicket(ticket, 'resolveInboxTicket');
}

export async function linkConversationToTicket(conversationId: string, ticketId: string) {
  const { data: duplicateActiveConversation, error: duplicateCheckError } = await supabase
    .from('conversations')
    .select('id')
    .eq('current_ticket_id', ticketId)
    .eq('status', 'active')
    .neq('id', conversationId)
    .limit(1)
    .maybeSingle();

  if (duplicateCheckError) throw duplicateCheckError;
  if (duplicateActiveConversation) {
    throw new Error('Ticket is already linked to another active conversation');
  }

  const { error } = await supabase
    .from('conversations')
    .update({ current_ticket_id: ticketId })
    .eq('id', conversationId);

  if (error) throw error;
  invalidateAllPreviewCaches();
}

export async function uploadInboxChatMedia(input: {
  file?: File;
  blob?: Blob;
  conversationId: string;
  ticketId: string | null;
  filePrefix?: string;
}) {
  const media = input.file || input.blob;
  if (!media) throw new Error('No media provided for upload');

  const fileExt = input.file ? input.file.name.split('.').pop() : 'jpg';
  const fileName = `${input.filePrefix || 'inbox'}_${input.conversationId}_${Date.now()}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('chat_media')
    .upload(fileName, media, { 
      contentType: input.file ? input.file.type : 'image/jpeg',
      upsert: true
    });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from('chat_media').getPublicUrl(fileName);

  const messageType = (input.file?.type.startsWith('image/') || input.blob) ? 'image' : 'file';

  await sendInboxAgentMessage({
    conversationId: input.conversationId,
    ticketId: input.ticketId,
    content: publicUrl,
    messageType,
    mediaMimeType: input.file ? input.file.type : 'image/jpeg',
  });

  return publicUrl;
}
