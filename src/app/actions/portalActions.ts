'use server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Securely sends a message from the Portal (Customer side)
 * Verifies that the LINE User ID owns the ticket before inserting.
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

  // 1. Verify Ownership
  // Find customer by line_user_id
  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('line_user_id', lineUserId)
    .single();

  if (customerError || !customer) {
    throw new Error('Unauthorized: Customer not found');
  }

  // Verify ticket belongs to this customer
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('tickets')
    .select('id, customer_id')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    throw new Error('Ticket not found');
  }

  if (ticket.customer_id !== customer.id) {
    throw new Error('Unauthorized: You do not own this ticket');
  }

  // 2. Resolve Conversation ID
  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('current_ticket_id', ticketId)
    .maybeSingle();

  // 3. Insert Message Securely
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

  // 4. Update conversation timestamp if exists
  if (conversation) {
    await supabaseAdmin
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);
  }

  return message;
}
