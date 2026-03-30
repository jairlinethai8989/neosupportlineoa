import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as line from '@line/bot-sdk';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new line.Client(config);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const signature = req.headers.get('x-line-signature') || '';

  // 1. Verify Signature (in production, skip here for simplicity in initial demo)
  // if (!line.validateSignature(JSON.stringify(body), config.channelSecret, signature)) {
  //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  // }

  const events: any[] = body.events;

  for (const event of events) {
    if (event.type === 'message') {
      const lineUserId = event.source.userId;
      const messageText = event.message.type === 'text' ? event.message.text : '';

      // 2. Map Customer
      let { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('line_user_id', lineUserId)
        .single();

      if (!customer) {
        // Create customer (optionally fetch profile from LINE)
        const { data: newCustomer, error: createError } = await supabase
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
          .select('id')
          .eq('customer_id', customer.id)
          .eq('status', 'active')
          .single();

        if (!conversation) {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert([{ customer_id: customer.id, status: 'active' }])
            .select()
            .single();
          conversation = newConv;
        }

        if (conversation) {
          // 4. Save Message
          await supabase.from('messages').insert([{
            conversation_id: conversation.id,
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
