'use server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendLineGroupNotification } from '@/lib/utils/lineNotifications';

/**
 * Securely sends a message from the Portal (Customer side).
 * Verifies that the LINE User ID owns the ticket before inserting.
 * After successful insert, pushes a LINE notification to the internal staff group.
 */
export async function sendPortalMessageAction(
  ticketId: string, 
  lineUserId: string, 
  content: string, 
  messageType: string = 'text'
) {
  if (!ticketId || !lineUserId || !content) {
    throw new Error('Missing required fields');
  }

  // 1. Verify Ownership — find customer by line_user_id
  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('id, display_name')
    .eq('line_user_id', lineUserId)
    .single();

  if (customerError || !customer) {
    throw new Error('Unauthorized: Customer not found');
  }

  // 2. Verify ticket belongs to this customer
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('tickets')
    .select('id, customer_id, ticket_no')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    throw new Error('Ticket not found');
  }

  if (ticket.customer_id !== customer.id) {
    throw new Error('Unauthorized: You do not own this ticket');
  }

  // 3. Resolve Conversation ID
  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('current_ticket_id', ticketId)
    .maybeSingle();

  // 4. Insert Message Securely
  const { data: message, error: insertError } = await supabaseAdmin
    .from('messages')
    .insert([{
      ticket_id: ticketId,
      conversation_id: conversation?.id || null,
      sender_type: 'customer',
      customer_id: customer.id,
      content: content,
      message_type: messageType
    }])
    .select()
    .single();

  if (insertError) {
    throw new Error('Failed to send message: ' + insertError.message);
  }

  // 5. Update conversation timestamp if exists
  if (conversation) {
    await supabaseAdmin
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);
  }

  // 6. Push LINE notification to internal staff group (non-blocking)
  const groupId = process.env.LINE_GROUP_ID;
  if (groupId) {
    const displayName = customer.display_name || 'ลูกค้า';
    const preview = messageType === 'text'
      ? (content.length > 60 ? content.slice(0, 60) + '…' : content)
      : '📎 ส่งไฟล์/รูปภาพ';

    void sendLineGroupNotification(
      `📩 ลูกค้าตอบกลับในใบงาน #${ticket.ticket_no}\nจาก: ${displayName}\nข้อความ: ${preview}`,
      groupId
    );
  }

  return message;
}
