'use server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { invalidateAllLiveCaches } from '@/lib/cache/liveCache';
import { invalidateAllPreviewCaches } from '@/lib/reports/previewCache';
import { sendLineUserNotification } from '@/lib/utils/lineNotifications';

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://neoworkspace.vercel.app').replace(/\/$/, '');

async function pushAgentReplyToLineInternal(
  conversationId: string,
  ticketId: string | null,
  content: string,
  messageType: string
) {
  try {
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('customer_id, current_ticket_id, customers(line_user_id)')
      .eq('id', conversationId)
      .maybeSingle();

    const customerRel = Array.isArray(conversation?.customers)
      ? conversation?.customers[0]
      : conversation?.customers;
    const lineUserId = (customerRel as { line_user_id?: string | null } | null)?.line_user_id;
    if (!lineUserId) return false;

    const resolvedTicketId = ticketId || conversation?.current_ticket_id || null;
    let ticketNo: string | null = null;
    if (resolvedTicketId) {
      const { data: ticket } = await supabaseAdmin
        .from('tickets')
        .select('ticket_no')
        .eq('id', resolvedTicketId)
        .maybeSingle();
      ticketNo = ticket?.ticket_no || null;
    }

    const portalLink = resolvedTicketId
      ? `${APP_BASE_URL}/portal/tickets/${resolvedTicketId}`
      : `${APP_BASE_URL}/portal`;
    const ticketPrefix = ticketNo ? `[#${ticketNo}] ` : '';

    if (messageType === 'image' && content.startsWith('https://')) {
      return await sendLineUserNotification(lineUserId, [
        {
          type: 'image',
          originalContentUrl: content,
          previewImageUrl: content,
        },
        {
          type: 'text',
          text: `${ticketPrefix}เจ้าหน้าที่ส่งรูปภาพให้คุณ\nเปิดดูแชท: ${portalLink}`,
        },
      ]);
    }

    const bodyText =
      messageType === 'text'
        ? content
        : `ส่งไฟล์แนบ (${messageType}): ${content}`;

    return await sendLineUserNotification(lineUserId, {
      type: 'text',
      text: `${ticketPrefix}เจ้าหน้าที่ตอบกลับ:\n${bodyText}\n\nดูรายละเอียดเพิ่มเติม: ${portalLink}`,
    });
  } catch (err) {
    console.error('[LinePush] Failed to push agent reply to LINE:', err);
    return false;
  }
}

export async function pushAgentReplyToLineAction(
  conversationId: string,
  ticketId: string | null,
  content: string,
  messageType: string = 'text'
) {
  const user = await getSessionUser();
  await verifyAgentRole(user.id);
  return pushAgentReplyToLineInternal(conversationId, ticketId, content, messageType);
}

async function getSessionUser() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
      },
    }
  );
  
  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) throw new Error('Unauthorized Access. Invalid Session.');
  return user;
}

async function verifyAgentRole(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile || !['Agent', 'Administrator'].includes(profile.role)) {
    throw new Error('Unauthorized: Agent role required');
  }
  return profile.role;
}

export async function sendAgentMessageAction(
  conversationId: string, 
  ticketId: string | null, 
  content: string, 
  messageType: string = 'text',
  mediaMimeType?: string
) {
  const user = await getSessionUser();
  await verifyAgentRole(user.id);

  const { error: dbError } = await supabaseAdmin.from('messages').insert([{
    conversation_id: conversationId,
    ticket_id: ticketId,
    sender_type: 'agent',
    staff_id: user.id,
    content: messageType === 'text' ? content : `[${messageType.toUpperCase()} Attachment]`,
    message_type: messageType,
    media_path: messageType !== 'text' ? content : null,
    media_mime_type: mediaMimeType || null
  }]);
  
  if (dbError) throw new Error(dbError.message);

  await supabaseAdmin.from('conversations').update({
    last_message_at: new Date().toISOString()
  }).eq('id', conversationId);

  void pushAgentReplyToLineInternal(conversationId, ticketId, content, messageType);
}

export async function sendSystemMessageAction(
  conversationId: string, 
  content: string
) {
  const user = await getSessionUser();
  await verifyAgentRole(user.id);

  const { error: dbError } = await supabaseAdmin.from('messages').insert([{
    conversation_id: conversationId,
    sender_type: 'system',
    content: content,
    message_type: 'text'
  }]);
  
  if (dbError) throw new Error(dbError.message);
}

export async function closeConversationAction(conversationId: string) {
  const user = await getSessionUser();
  await verifyAgentRole(user.id);

  await supabaseAdmin.from('conversations')
    .update({ status: 'closed', current_ticket_id: null })
    .eq('id', conversationId);
  
  await supabaseAdmin.from('messages').insert([{
    conversation_id: conversationId,
    sender_type: 'system',
    content: '[SYSTEM] จบการสนทนาโดยเจ้าหน้าที่',
    message_type: 'text'
  }]);
  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
}

export async function deleteMessageAction(messageId: string) {
  try {
    const user = await getSessionUser();
    await verifyAgentRole(user.id);

    // Get message details
    const { data: message, error: fetchError } = await supabaseAdmin
      .from('messages')
      .select('staff_id, sender_type')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return { success: false, error: 'Message not found' };
    }
    
    // Authorization check
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
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
      .eq('id', messageId);
      
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
