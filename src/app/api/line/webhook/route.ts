/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as line from '@line/bot-sdk';

import crypto from 'crypto';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'unset',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'unset',
};

const client = new line.Client(config);

async function getLineProfileSnapshot(userId: string) {
  try {
    const profile = await client.getProfile(userId);
    return {
      display_name: profile.displayName || 'LINE User',
      avatar_url: profile.pictureUrl || null,
    };
  } catch (error) {
    console.warn(`Webhook: Failed to fetch LINE profile for ${userId}`, error);
    return {
      display_name: 'LINE User',
      avatar_url: null,
    };
  }
}

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

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
    // 0. QUICK CHECK: Get Group ID Command
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.toLowerCase().trim();
      if (text === 'get group id') {
        const sourceId = event.source.groupId || event.source.roomId || event.source.userId;
        try {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `ID ของกลุ่ม/แชทนี้คือ:\n${sourceId}`
          });
        } catch (e) { console.error('Reply ID failed:', e); }
        continue; // Stop processing this event further
      }
    }

    if (event.type === 'message') {
      // 1. SECURITY/UX FILTER: Only process 1-on-1 private messages for the Inbox
      // This prevents group chat pollution and "ghost" messages from reports
      if (event.source.type !== 'user') {
        console.log(`Webhook: Ignoring non-user message from ${event.source.type}: ${event.source.groupId || event.source.roomId}`);
        continue;
      }

      const lineUserId = event.source.userId;
      if (!lineUserId) continue; // Safety check
      
      const messageText = event.message.type === 'text' ? event.message.text : `[Attachment: ${event.message.type}]`;
      const lineProfile = await getLineProfileSnapshot(lineUserId);

      // 2. Map Customer
      let { data: customer } = await supabaseAdmin
        .from('customers')
        .select('id, display_name, avatar_url')
        .eq('line_user_id', lineUserId)
        .maybeSingle();

      if (!customer) {
        const { data: newCustomer } = await supabaseAdmin
          .from('customers')
          .insert([{ 
             line_user_id: lineUserId, 
             display_name: lineProfile.display_name,
             avatar_url: lineProfile.avatar_url,
             metadata: { original_event: event } 
          }])
          .select()
          .single();
        customer = newCustomer;
      } else if (
        customer.display_name !== lineProfile.display_name ||
        (customer.avatar_url || null) !== lineProfile.avatar_url
      ) {
        const { data: updatedCustomer } = await supabaseAdmin
          .from('customers')
          .update({
            display_name: lineProfile.display_name,
            avatar_url: lineProfile.avatar_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customer.id)
          .select('id, display_name, avatar_url')
          .single();

        customer = updatedCustomer || customer;
      }

      if (customer) {
        // 3. Map/Create Conversation
        let { data: conversation } = await supabaseAdmin
          .from('conversations')
          .select('id, current_ticket_id')
          .eq('customer_id', customer.id)
          .eq('status', 'active')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!conversation) {
          // AUTO-LINK: Find the most recent OPEN ticket for this customer before creating conv
          let { data: recentTicket } = await supabaseAdmin
            .from('tickets')
            .select('id, ticket_no')
            .eq('customer_id', customer.id)
            .not('status', 'in', '("Resolved","Closed")') // Only link to open ones
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // CREATE TICKET IF NONE EXISTS
          if (!recentTicket) {
             const { data: newTicket } = await supabaseAdmin
              .from('tickets')
              .insert([{
                customer_id: customer.id,
                subject: `LINE Support: ${messageText?.substring(0, 30)}${messageText?.length > 30 ? '...' : ''}`,
                status: 'New',
                priority: 'Medium',
                current_department_id: '2ebdd410-7f71-4924-8dde-1a923fcf72b2' // แผนกเทคโนโลยีสารสนเทศ (IT Department)
              }])
              .select()
              .single();
             recentTicket = newTicket;
          }

          const { data: newConv } = await supabaseAdmin
            .from('conversations')
            .insert([{ 
                customer_id: customer.id, 
                status: 'active',
                current_ticket_id: recentTicket?.id || null 
            }])
            .select()
            .single();
          conversation = newConv;

          /* 
          // Notify Group about New Support Request (First Message) - DISABLED per user request for manual control
          try {
            const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
            const alertText = recentTicket?.ticket_no 
              ? `🆕 [ตั๋วใหม่] #${recentTicket.ticket_no} - ${customer.display_name} แจ้งปัญหาเข้ามาครับ`
              : `🆕 [ข้อความ] ${customer.display_name} แจ้งปัญหาเข้ามาครับ`;
            
            await sendLineGroupNotification(`${alertText}\nข้อความ: ${messageText?.substring(0, 50)}${messageText?.length > 50 ? '...' : ''}\n👉 ตรวจสอบที่หน้าจัดการ: ${process.env.NEXT_PUBLIC_BASE_URL || 'NeoSupport Dashboard'}`);
          } catch(e) { console.error('Notif failed:', e); }
          */
        }

        if (conversation) {
          // 4. Atomic Idempotency Insert (P1 Security)
          const { error: messageError } = await supabaseAdmin.from('messages').insert([{
            conversation_id: conversation.id,
            ticket_id: conversation.current_ticket_id,
            sender_type: 'customer',
            customer_id: customer.id,
            content: messageText || '...', // Temp content for media
            line_message_id: event.message.id,
            line_uid: event.source.userId,
            message_type: event.message.type === 'text' ? 'text' : 
                         (['image', 'video', 'file', 'audio'].includes(event.message.type) ? event.message.type : 'text')
          }]);

          if (messageError) {
             // 23505 is PostgreSQL unique constraint violation
             if (messageError.code === '23505') {
                 console.log(`Webhook: Atomic idempotency blocked duplicate message ${event.message.id}`);
                 continue; // Abort processing, media won't be downloaded twice
             }
             console.error(`Webhook: Message insert error:`, messageError);
             continue;
          }

          let finalContent = messageText;

          // 5. Handle Media Contents (Images, Video, Files)
          if (['image', 'video', 'file', 'audio'].includes(event.message.type)) {
            try {
              console.log(`Webhook: Processing ${event.message.type} from ${event.message.contentProvider?.type || 'line'} provider`);
              
              let buffer: Buffer;
              
              if (event.message.contentProvider?.type === 'external') {
                const externalUrl = event.message.originalContentUrl;
                const res = await fetch(externalUrl);
                const arrayBuffer = await res.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
              } else {
                const responseStream: any = await client.getMessageContent(event.message.id);
                buffer = await new Promise<Buffer>((resolve, reject) => {
                  const _chunks: Buffer[] = [];
                  responseStream.on('data', (chunk: Buffer) => _chunks.push(chunk));
                  responseStream.on('end', () => resolve(Buffer.concat(_chunks)));
                  responseStream.on('error', (err: any) => reject(err));
                });
              }

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
              
              const { error: uploadError } = await supabaseAdmin.storage
                .from('chat_media')
                .upload(fileName, buffer, {
                  contentType: contentType,
                  cacheControl: '3600',
                  upsert: true
                });

              if (!uploadError) {
                finalContent = fileName;
                
                // Update the previously inserted message with the final URL
                await supabaseAdmin.from('messages')
                  .update({ content: finalContent })
                  .eq('line_message_id', event.message.id);
              } else {
                console.error('Webhook: Upload Error:', uploadError);
              }
            } catch (err) {
              console.error('Webhook: Media Fetch Error:', err);
            }
          }

          // Update conversation timestamp
          await supabaseAdmin.from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversation.id);
        }
      }
    }
  }

  return NextResponse.json({ status: 'ok' });
}
