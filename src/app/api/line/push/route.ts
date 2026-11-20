import { NextResponse } from 'next/server';
import type * as line from '@line/bot-sdk';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { sendLineUserNotification } from '@/lib/utils/lineNotifications';

/**
 * API Route for Outbound / Push Messages
 * Allows sending messages from the agent dashboard to specific LINE users per project.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Access denied.' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || (profile.role !== 'Agent' && profile.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions.' }, { status: 403 });
  }

  try {
    const { to, messages, projectId } = await req.json();

    if (!to || !messages || !Array.isArray(messages)) {
      return NextResponse.json({
        error: 'Invalid Request: Missing "to" userId or "messages" array.',
      }, { status: 400 });
    }

    const ok = await sendLineUserNotification(to, messages as line.Message[], projectId || null);
    if (!ok) {
      return NextResponse.json({
        error: 'Failed to send message via LINE (check project LINE Channel Access Token or user ID).',
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      message: 'Message sent successfully to LINE.',
    });
  } catch (error: unknown) {
    console.error('LINE Messaging API Push Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({
      error: 'Failed to send message via LINE',
      details: errorMessage,
    }, { status: 500 });
  }
}
