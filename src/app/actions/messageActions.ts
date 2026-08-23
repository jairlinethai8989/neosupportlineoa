'use server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateAllLiveCaches } from '@/lib/cache/liveCache';
import { invalidateAllPreviewCaches } from '@/lib/reports/previewCache';
import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import { parseTicketDetailId, parseTicketDetailMessage } from '@/lib/tickets/ticketDetailSecurity';
import { parseInboxAttachmentReference } from '@/lib/inbox/inboxMediaSecurity';
import { getInternalAttachmentMediaInfo, parseInternalAttachmentUpload } from '@/lib/tickets/internalTicketSecurity';
import { PRIVATE_CHAT_MEDIA_BUCKET } from '@/lib/media/chatMediaPath';
import crypto from 'crypto';

function parseConversationId(value: unknown) {
  try {
    return parseTicketDetailId(value);
  } catch {
    throw new Error('Invalid conversation ID');
  }
}

function parseOptionalTicketId(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return parseTicketDetailId(value);
}

async function assertConversationTicketRelationship(conversationId: string, ticketId: string | null) {
  const { data: conversation, error } = await supabaseAdmin.from('conversations')
    .select('id, customer_id, current_ticket_id').eq('id', conversationId).maybeSingle();
  if (error || !conversation) throw new Error('Conversation not found');
  if (!ticketId) return;
  const { data: ticket } = await supabaseAdmin.from('tickets').select('id, customer_id').eq('id', ticketId).maybeSingle();
  if (!ticket || (conversation.current_ticket_id !== ticketId && conversation.customer_id !== ticket.customer_id)) {
    throw new Error('Conversation does not belong to ticket');
  }
}

export async function sendAgentMessageAction(
  conversationId: string, 
  ticketId: string | null, 
  content: string, 
  messageType: string = 'text'
) {
  const { user } = await requireStaffAuth({ permission: 'inbox', level: 'edit' });
  const validConversationId = parseConversationId(conversationId);
  const validTicketId = parseOptionalTicketId(ticketId);
  if (messageType !== 'text') throw new Error('Attachment messages require the signed upload workflow');
  const validContent = parseTicketDetailMessage({ conversationId: validConversationId, content }).content;
  await assertConversationTicketRelationship(validConversationId, validTicketId);

  const { error: dbError } = await supabaseAdmin.from('messages').insert([{
    conversation_id: validConversationId,
    ticket_id: validTicketId,
    sender_type: 'agent',
    staff_id: user.id,
    content: validContent,
    message_type: 'text',
    media_path: null,
    media_mime_type: null
  }]);
  
  if (dbError) throw new Error(dbError.message);

  await supabaseAdmin.from('conversations').update({
    last_message_at: new Date().toISOString()
  }).eq('id', validConversationId);
  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
}

export async function sendSystemMessageAction(
  conversationId: string, 
  content: string
) {
  await requireStaffAuth({ permission: 'inbox', level: 'edit' });
  const validConversationId = parseConversationId(conversationId);
  const validContent = parseTicketDetailMessage({ conversationId: validConversationId, content }).content;
  await assertConversationTicketRelationship(validConversationId, null);

  const { error: dbError } = await supabaseAdmin.from('messages').insert([{
    conversation_id: validConversationId,
    sender_type: 'system',
    content: validContent,
    message_type: 'text'
  }]);
  
  if (dbError) throw new Error(dbError.message);
  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
}

export async function closeConversationAction(conversationId: string) {
  await requireStaffAuth({ permission: 'inbox', level: 'edit' });
  const validConversationId = parseConversationId(conversationId);
  await assertConversationTicketRelationship(validConversationId, null);

  await supabaseAdmin.from('conversations')
    .update({ status: 'closed', current_ticket_id: null })
    .eq('id', validConversationId);
  
  await supabaseAdmin.from('messages').insert([{
    conversation_id: validConversationId,
    sender_type: 'system',
    content: '[SYSTEM] จบการสนทนาโดยเจ้าหน้าที่',
    message_type: 'text'
  }]);
  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
}

export async function deleteMessageAction(messageId: string) {
  try {
    const { user, profile } = await requireStaffAuth({ permission: 'inbox', level: 'edit' });
    const validMessageId = parseTicketDetailId(messageId);

    // Get message details
    const { data: message, error: fetchError } = await supabaseAdmin
      .from('messages')
      .select('staff_id, sender_type')
      .eq('id', validMessageId)
      .single();

    if (fetchError || !message) {
      return { success: false, error: 'Message not found' };
    }
    
    // Authorization check
    const isAdmin = profile?.role === 'Administrator';
    
    if (message.staff_id !== user.id && !isAdmin) {
      return { success: false, error: 'Unauthorized: You can only unsend your own messages.' };
    }

    // Process unsending (soft delete)
    const { error: dbError } = await supabaseAdmin
      .from('messages')
      .update({ 
        message_type: 'unsent',
        content: '[ข้อความถูกยกเลิก]'
      })
      .eq('id', validMessageId);
      
    if (dbError) {
      return { success: false, error: dbError.message };
    }

    invalidateAllLiveCaches();
    invalidateAllPreviewCaches();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server Error';
    console.error('Delete Action Error:', err);
    return { success: false, error: message };
  }
}

export async function linkConversationToTicketAction(conversationValue: unknown, ticketValue: unknown) {
  await requireStaffAuth({ permission: 'inbox', level: 'edit' });
  const conversationId = parseConversationId(conversationValue);
  const ticketId = parseTicketDetailId(ticketValue);
  await assertConversationTicketRelationship(conversationId, ticketId);

  const { data: duplicate, error: duplicateError } = await supabaseAdmin.from('conversations')
    .select('id').eq('current_ticket_id', ticketId).eq('status', 'active')
    .neq('id', conversationId).limit(1).maybeSingle();
  if (duplicateError) throw new Error('Failed to validate conversation link');
  if (duplicate) throw new Error('Ticket is already linked to another active conversation');

  const { error } = await supabaseAdmin.from('conversations')
    .update({ current_ticket_id: ticketId, updated_at: new Date().toISOString() })
    .eq('id', conversationId);
  if (error) throw new Error('Failed to link conversation');
  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
  return { success: true } as const;
}

export async function createInboxAttachmentUploadAction(
  conversationValue: unknown,
  ticketValue: unknown,
  value: unknown
) {
  const { user } = await requireStaffAuth({ permission: 'inbox', level: 'edit' });
  const conversationId = parseConversationId(conversationValue);
  const ticketId = parseOptionalTicketId(ticketValue);
  const input = parseInternalAttachmentUpload(value);
  await assertConversationTicketRelationship(conversationId, ticketId);

  const path = `staff/${user.id}/conversations/${conversationId}/${crypto.randomUUID()}.${input.extension}`;
  const { data, error } = await supabaseAdmin.storage.from(PRIVATE_CHAT_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) throw new Error('Failed to authorize inbox attachment upload');
  return { path, token: data.token };
}

export async function sendInboxAttachmentAction(
  conversationValue: unknown,
  ticketValue: unknown,
  pathValue: unknown
) {
  const { user } = await requireStaffAuth({ permission: 'inbox', level: 'edit' });
  const conversationId = parseConversationId(conversationValue);
  const ticketId = parseOptionalTicketId(ticketValue);
  const path = parseInboxAttachmentReference(pathValue, user.id, conversationId);
  const media = getInternalAttachmentMediaInfo(path);
  await assertConversationTicketRelationship(conversationId, ticketId);

  const slash = path.lastIndexOf('/');
  const directory = path.slice(0, slash);
  const filename = path.slice(slash + 1);
  const { data: objects, error: listError } = await supabaseAdmin.storage
    .from(PRIVATE_CHAT_MEDIA_BUCKET).list(directory, { search: filename, limit: 2 });
  if (listError || !objects?.some((object) => object.name === filename)) {
    throw new Error('Inbox attachment upload is incomplete');
  }

  const { data: message, error } = await supabaseAdmin.from('messages').insert([{
    conversation_id: conversationId,
    ticket_id: ticketId,
    sender_type: 'agent',
    staff_id: user.id,
    content: media.content,
    message_type: media.messageType,
    media_path: path,
    media_mime_type: media.mimeType,
  }]).select('id, content, sender_type, staff_id, ticket_id, conversation_id, message_type, media_path, media_mime_type, created_at').single();
  if (error || !message) {
    await supabaseAdmin.storage.from(PRIVATE_CHAT_MEDIA_BUCKET).remove([path]);
    throw new Error('Failed to save inbox attachment');
  }

  await supabaseAdmin.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);
  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
  return message;
}
