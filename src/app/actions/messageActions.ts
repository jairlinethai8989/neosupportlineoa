'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  messageType: string = 'text'
) {
  const user = await getSessionUser();
  await verifyAgentRole(user.id);

  const { error: dbError } = await supabaseAdmin.from('messages').insert([{
    conversation_id: conversationId,
    ticket_id: ticketId,
    sender_type: 'agent',
    staff_id: user.id,
    content: content,
    message_type: messageType
  }]);
  
  if (dbError) throw new Error(dbError.message);

  await supabaseAdmin.from('conversations').update({
    last_message_at: new Date().toISOString()
  }).eq('id', conversationId);
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
    .update({ status: 'closed' })
    .eq('id', conversationId);
  
  await supabaseAdmin.from('messages').insert([{
    conversation_id: conversationId,
    sender_type: 'system',
    content: '[SYSTEM] จบการสนทนาโดยเจ้าหน้าที่',
    message_type: 'text'
  }]);
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

    // Process deletion
    const { error: dbError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('id', messageId);
      
    if (dbError) {
      return { success: false, error: dbError.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Delete Action Error:', err);
    return { success: false, error: err.message || 'Server Error' };
  }
}
