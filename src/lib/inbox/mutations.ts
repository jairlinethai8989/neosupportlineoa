import {
  closeConversationAction,
  createInboxAttachmentUploadAction,
  deleteMessageAction,
  linkConversationToTicketAction,
  sendAgentMessageAction,
  sendInboxAttachmentAction,
  sendSystemMessageAction,
} from '@/app/actions/messageActions';
import { ticketService } from '@/lib/services/ticketService';
import { supabase } from '@/lib/supabase';
import { normalizeInboxTicket } from '@/lib/inbox/normalizers';
import { invalidateAllPreviewCaches } from '@/lib/reports/previewCache';
import type { InboxTicket } from '@/types/inbox';
import { compressImage } from '@/lib/utils/imageCompression';
import { createStaffChatMediaUrl, PRIVATE_CHAT_MEDIA_BUCKET } from '@/lib/media/chatMediaPath';

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
  staffId: string;
  content: string;
  messageType?: string;
  mediaMimeType?: string;
}) {
  const messageType = input.messageType || 'text';
  if (messageType !== 'text') throw new Error('Attachment messages require uploadInboxChatMedia');
  await sendAgentMessageAction(input.conversationId, input.ticketId, input.content, 'text');
  return { success: true as const };
}

export async function sendInboxSystemMessage(conversationId: string, content: string) {
  await sendSystemMessageAction(conversationId, content);
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

export async function resolveInboxTicket(input: ResolveInboxTicketInput & { conversationId?: string }): Promise<InboxTicket> {
  const ticket = await ticketService.resolve(
    input.ticketId,
    input.agentId,
    input.resolutionSummary,
    input.module,
    input.issueType,
    input.conversationId
  );
  invalidateAllPreviewCaches();
  return requireNormalizedTicket(ticket, 'resolveInboxTicket');
}

export async function linkConversationToTicket(conversationId: string, ticketId: string) {
  await linkConversationToTicketAction(conversationId, ticketId);
}

export async function uploadInboxChatMedia(input: {
  file?: File;
  blob?: Blob;
  conversationId: string;
  ticketId: string | null;
  staffId: string;
  filePrefix?: string;
}) {
  let media = input.file || input.blob;
  if (!media) throw new Error('No media provided for upload');

  // Compress if it's an image
  if (media.type.startsWith('image/')) {
    try {
      media = await compressImage(media, { quality: 1.0 });
    } catch (err) {
      console.error('Image compression failed, uploading original:', err);
    }
  }

  const isImage = media.type.startsWith('image/') || media.type === 'image/webp';
  const fileExt = isImage ? 'webp' : (input.file ? input.file.name.split('.').pop() : 'bin');
  const upload = await createInboxAttachmentUploadAction(input.conversationId, input.ticketId, {
    mimeType: media.type,
    extension: fileExt,
    size: media.size,
  });
  const { error: uploadError } = await supabase.storage
    .from(PRIVATE_CHAT_MEDIA_BUCKET)
    .uploadToSignedUrl(upload.path, upload.token, media, { contentType: media.type });

  if (uploadError) throw uploadError;

  await sendInboxAttachmentAction(input.conversationId, input.ticketId, upload.path);

  return createStaffChatMediaUrl(upload.path);
}
