/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as line from '@line/bot-sdk';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'unset',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'unset',
};

const client = new line.Client(config);

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
          // AUTO-LINK: Find the most recent OPEN ticket for this customer before creating conv
          const { data: recentTicket } = await supabase
            .from('tickets')
            .select('id')
            .eq('customer_id', customer.id)
            .not('status', 'in', '("Resolved","Closed")') // Only link to open ones
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: newConv } = await supabase
            .from('conversations')
            .insert([{ 
                customer_id: customer.id, 
                status: 'active',
                current_ticket_id: recentTicket?.id || null 
            }])
            .select()
            .single();
          conversation = newConv;

          // Notify Group about New Support Request (First Message)
          try {
            const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
            const alertText = recentTicket 
              ? `🆕 [ตั๋วเดิม] ${customer.display_name} ส่งข้อความในตั๋วที่มีอยู่`
              : `🆕 [ตั๋วใหม่] ${customer.display_name} แจ้งปัญหาเข้ามาครับ`;
            
            await sendLineGroupNotification(`${alertText}\nข้อความ: ${messageText?.substring(0, 50)}${messageText?.length > 50 ? '...' : ''}\n👉 ตรวจสอบที่หน้าจัดการ: ${process.env.NEXT_PUBLIC_BASE_URL || 'NeoSupport Dashboard'}`);
          } catch(e) { console.error('Notif failed:', e); }
        }

        if (conversation) {
          let finalContent = messageText;

          // 4. Handle Media Contents (Images, Video, Files)
          if (['image', 'video', 'file'].includes(event.message.type)) {
            try {
              // Fetch Original Content from LINE
              const stream = await client.getMessageContent(event.message.id);
              const chunks: any[] = [];
              for await (const chunk of stream) {
                chunks.push(chunk);
              }
              const buffer = Buffer.concat(chunks);

              // Upload to Supabase Storage
              const fileExt = event.message.type === 'image' ? 'jpg' : (event.message.type === 'video' ? 'mp4' : 'bin');
              const fileName = `customer/${customer.id}/${event.message.id}_${Date.now()}.${fileExt}`;
              
              const { error: uploadError } = await supabase.storage
                .from('chat_media')
                .upload(fileName, buffer, {
                  contentType: event.message.type === 'image' ? 'image/jpeg' : (event.message.type === 'video' ? 'video/mp4' : 'application/octet-stream'),
                  upsert: true
                });

              if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                  .from('chat_media')
                  .getPublicUrl(fileName);
                finalContent = publicUrl;
              } else {
                console.error('Upload Error:', uploadError);
              }
            } catch (err) {
              console.error('LINE Content Fetch Error:', err);
            }
          }

          // 5. Save Message
          await supabase.from('messages').insert([{
            conversation_id: conversation.id,
            ticket_id: conversation.current_ticket_id,
            sender_type: 'customer',
            message_type: event.message.type,
            content: finalContent,
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
