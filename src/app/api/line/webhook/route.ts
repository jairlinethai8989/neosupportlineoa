/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as line from '@line/bot-sdk';
import { invalidateAllLiveCaches } from '@/lib/cache/liveCache';
import { invalidateAllPreviewCaches } from '@/lib/reports/previewCache';

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
    };
  } catch (error) {
    console.warn(`Webhook: Failed to fetch LINE profile for ${userId}`, error);
    return {
      display_name: 'LINE User',
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

  let hasDataMutation = false;

  for (const event of events) {
    // 0. QUICK CHECK: Get Group ID Command
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.toLowerCase().trim();
      if (text === 'get group id') {
        const sourceId = event.source.groupId || event.source.roomId || event.source.userId;
        try {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `ID à¸‚à¸­à¸‡à¸à¸¥à¸¸à¹ˆà¸¡/à¹à¸Šà¸—à¸™à¸µà¹‰à¸„à¸·à¸­:\n${sourceId}`
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
        .select('id, display_name')
        .eq('line_user_id', lineUserId)
        .maybeSingle();

      if (!customer) {
        const { data: newCustomer } = await supabaseAdmin
          .from('customers')
          .insert([{ 
             line_user_id: lineUserId, 
             display_name: lineProfile.display_name,
             metadata: { original_event: event } 
          }])
          .select()
          .single();
        customer = newCustomer;
        hasDataMutation = true;
      } else if (customer.display_name !== lineProfile.display_name) {
        const { data: updatedCustomer } = await supabaseAdmin
          .from('customers')
          .update({
            display_name: lineProfile.display_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customer.id)
          .select('id, display_name')
          .single();

        customer = updatedCustomer || customer;
        hasDataMutation = true;
      }

      if (customer) {
        // 3. Accept only app-linked conversations.
        // Do not create tickets/conversations from direct OA chat messages.
        const { data: conversation } = await supabaseAdmin
          .from('conversations')
          .select('id, current_ticket_id')
          .eq('customer_id', customer.id)
          .eq('status', 'active')
          .not('current_ticket_id', 'is', null)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!conversation) {
          console.log(
            `Webhook: Ignored direct LINE OA message for customer ${customer.id} (no active ticket-linked conversation)`
          );
          continue;
        }

        if (conversation) {
          // 4. Atomic Idempotency Insert (P1 Security)
          const { error: messageError } = await supabaseAdmin.from('messages').insert([{
            conversation_id: conversation.id,
            ticket_id: conversation.current_ticket_id,
            sender_type: 'customer',
            customer_id: customer.id,
            content: event.message.type === 'text' ? messageText : `[${event.message.type.toUpperCase()} Attachment]`,
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
          hasDataMutation = true;

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
                const {
                  data: { publicUrl },
                } = supabaseAdmin.storage.from('chat_media').getPublicUrl(fileName);
                
                finalContent = publicUrl;
                
                // Update the previously inserted message with the final URL in media_path
                await supabaseAdmin.from('messages')
                  .update({ 
                    media_path: finalContent,
                    media_mime_type: contentType
                  })
                  .eq('line_message_id', event.message.id);
                hasDataMutation = true;
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
          hasDataMutation = true;
        }
      }
    }
  }

  if (hasDataMutation) {
    invalidateAllLiveCaches();
    invalidateAllPreviewCaches();
  }

  return NextResponse.json({ status: 'ok' });
}

