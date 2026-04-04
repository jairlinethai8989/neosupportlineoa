/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

<<<<<<< HEAD
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'unset',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'unset',
};

const client = new line.Client(config);

=======
>>>>>>> 98085ef (feat: Modernize Ticket Dashboard (Status-based Colorbands, Memory Optimization, List View Hospital Column))
export async function POST(req: Request) {
  let body: any;
  try {
     body = await req.json();
  } catch {
     console.error('Webhook: Non-JSON body received');
     return NextResponse.json({ error: 'Body required' }, { status: 400 });
  }

  const events: any[] = body.events || [];
  
  if (events.length === 0) {
    return NextResponse.json({ status: 'ok' });
  }

  for (const event of events) {
    if (event.type === 'message') {
      const lineUserId = event.source.userId;
      if (!lineUserId) continue; // Safety check
      
      const messageText = event.message.type === 'text' ? event.message.text : `[Attachment: ${event.message.type}]`;

      // 2. Map Customer
      let { data: customer } = await supabase
        .from('customers')
        .select('id, display_name')
        .eq('line_user_id', lineUserId)
        .single();

      if (!customer) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert([{ 
             line_user_id: lineUserId, 
             display_name: 'LINE User', 
             metadata: { original_event: event } 
          }])
          .select()
          .single();
        customer = newCustomer;
      }

      if (customer) {
        // 3. Map/Create Conversation
        let { data: conversation } = await supabase
          .from('conversations')
          .select('id, current_ticket_id')
          .eq('customer_id', customer.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!conversation) {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert([{ customer_id: customer.id, status: 'active' }])
            .select()
            .single();
          conversation = newConv;

          // Notify Group about New Support Request (First Message)
          try {
            const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
            await sendLineGroupNotification(`🆕 [ตั๋วใหม่] คุณ ${customer.display_name || 'ลูกค้าใหม่'} แจ้งปัญหาเข้ามาครับ\nข้อความ: ${messageText?.substring(0, 50)}${messageText?.length > 50 ? '...' : ''}\n👉 ตรวจสอบที่หน้าจัดการ: ${process.env.NEXT_PUBLIC_BASE_URL || 'NeoSupport Dashboard'}`);
          } catch(e) { console.error('Notif failed:', e); }
        }

        if (conversation) {
          // 4. Save Message
          await supabase.from('messages').insert([{
            conversation_id: conversation.id,
            ticket_id: conversation.current_ticket_id,
            sender_type: 'customer',
            message_type: event.message.type,
            content: messageText,
            line_message_id: event.message.id,
            media_metadata: event.message
          }]);

          // Update conversation timestamp
          await supabase.from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversation.id);
        }
      }
    }
  }

  return NextResponse.json({ status: 'ok' });
}
