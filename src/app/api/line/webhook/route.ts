/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as line from '@line/bot-sdk';

import crypto from 'crypto';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'unset',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'unset',
};

const client = new line.Client(config);

export async function POST(req: Request) {
  const signature = req.headers.get('x-line-signature');
  const rawBody = await req.text();

  if (!signature) {
    return NextResponse.json({ error: 'Signature required' }, { status: 401 });
  }

  // 1. Verify Signature
  const checkSig = crypto
    .createHmac('SHA256', config.channelSecret)
    .update(rawBody)
    .digest('base64');

  if (checkSig !== signature) {
    console.error('Webhook: Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: any;
  try {
     body = JSON.parse(rawBody);
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
          let { data: recentTicket } = await supabase
            .from('tickets')
            .select('id, ticket_no')
            .eq('customer_id', customer.id)
            .not('status', 'in', '("Resolved","Closed")') // Only link to open ones
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // CREATE TICKET IF NONE EXISTS
          if (!recentTicket) {
             const { data: newTicket } = await supabase
              .from('tickets')
              .insert([{
                customer_id: customer.id,
                subject: `LINE Support: ${messageText?.substring(0, 30)}${messageText?.length > 30 ? '...' : ''}`,
                status: 'New',
                priority: 'Medium',
                department: 'Customer Service'
              }])
              .select()
              .single();
             recentTicket = newTicket;
          }

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
            const alertText = recentTicket?.ticket_no 
              ? `🆕 [ตั๋วใหม่] #${recentTicket.ticket_no} - ${customer.display_name} แจ้งปัญหาเข้ามาครับ`
              : `🆕 [ข้อความ] ${customer.display_name} แจ้งปัญหาเข้ามาครับ`;
            
            await sendLineGroupNotification(`${alertText}\nข้อความ: ${messageText?.substring(0, 50)}${messageText?.length > 50 ? '...' : ''}\n👉 ตรวจสอบที่หน้าจัดการ: ${process.env.NEXT_PUBLIC_BASE_URL || 'NeoSupport Dashboard'}`);
          } catch(e) { console.error('Notif failed:', e); }
        }

        if (conversation) {
          let finalContent = messageText;

          // 4. Handle Media Contents (Images, Video, Files)
          if (['image', 'video', 'file', 'audio'].includes(event.message.type)) {
            try {
              console.log(`Webhook: Processing ${event.message.type} from ${event.message.contentProvider?.type || 'line'} provider`);
              
              let buffer: Buffer;
              
              if (event.message.contentProvider?.type === 'external') {
                // Fetch from external URL
                const externalUrl = event.message.originalContentUrl;
                console.log(`Webhook: Downloading external content from ${externalUrl}`);
                const res = await fetch(externalUrl);
                const arrayBuffer = await res.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
              } else {
                // Fetch Content from LINE using ID
                const responseStream: any = await client.getMessageContent(event.message.id);
                buffer = await new Promise<Buffer>((resolve, reject) => {
                  const _chunks: Buffer[] = [];
                  responseStream.on('data', (chunk: Buffer) => _chunks.push(chunk));
                  responseStream.on('end', () => resolve(Buffer.concat(_chunks)));
                  responseStream.on('error', (err: any) => reject(err));
                });
              }

              console.log(`Webhook: Downloaded ${event.message.type}. Size: ${buffer.length} bytes. Signature: ${buffer.slice(0, 4).toString('hex')}`);

              // Upload to Supabase Storage
              let fileExt = 'bin';
              let contentType = 'application/octet-stream';

              if (event.message.type === 'image') {
                const sig = buffer.slice(0, 4).toString('hex');
                if (sig === '89504e47') {
                  fileExt = 'png';
                  contentType = 'image/png';
                } else if (sig.startsWith('ffd8ff')) {
                  fileExt = 'jpg';
                  contentType = 'image/jpeg';
                } else if (buffer.slice(0, 4).toString('ascii') === 'RIFF') {
                  fileExt = 'webp';
                  contentType = 'image/webp';
                } else {
                  fileExt = 'jpg';
                  contentType = 'image/jpeg';
                }
              } else if (event.message.type === 'video') {
                fileExt = 'mp4';
                contentType = 'video/mp4';
              } else if (event.message.type === 'audio') {
                fileExt = 'm4a';
                contentType = 'audio/x-m4a';
              }

              const fileName = `customer/${customer.id}/${event.message.id}_${Date.now()}.${fileExt}`;
              
              const { error: uploadError } = await supabase.storage
                .from('chat_media')
                .upload(fileName, buffer, {
                  contentType: contentType,
                  cacheControl: '3600',
                  upsert: true
                });

              if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                  .from('chat_media')
                  .getPublicUrl(fileName);
                finalContent = publicUrl;
              } else {
                console.error('Webhook: Upload Error:', uploadError);
              }
            } catch (err) {
              console.error('Webhook: Media Fetch Error:', err);
            }
          }


          // 5. Save Message
          console.log(`Webhook: Saving message for ticket ${conversation.current_ticket_id}`);
          await supabase.from('messages').insert([{
            conversation_id: conversation.id,
            ticket_id: conversation.current_ticket_id,
            sender_type: 'customer',
            customer_id: customer.id, // NEW STRONG RELATION
            content: finalContent,
            line_message_id: event.message.id,
            line_uid: event.source.userId,
            message_type: event.message.type === 'text' ? 'text' : 
                         (['image', 'video', 'file', 'audio'].includes(event.message.type) ? event.message.type : 'text')
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
