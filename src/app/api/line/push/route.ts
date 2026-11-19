import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as line from '@line/bot-sdk';

/**
 * Configure LINE SDK client
 */
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'unset',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'unset',
};

const client = new line.Client(config);

/**
 * Helper: Validate authenticated user via Supabase
 */
async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op in read-only validation context
        },
      },
    }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

/**
 * API Route for Outbound / Push Messages
 * Allows sending messages from the agent dashboard to specific LINE users
 */
export async function POST(req: Request) {
  // 1. Auth Guard — only logged-in agents can send push messages
  const { user, error: authError } = await getAuthenticatedUser();
  if (!user || authError) {
    console.warn('Push API: Unauthorized request rejected');
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
  }

  try {
    const { to, messages } = await req.json();

    if (!to || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ 
        error: 'Invalid Request: Missing "to" userId or "messages" array.' 
      }, { status: 400 });
    }

    if (!config.channelAccessToken || config.channelAccessToken === 'unset') {
      return NextResponse.json({ 
        error: 'Configuration Error: LINE_CHANNEL_ACCESS_TOKEN is not set.' 
      }, { status: 500 });
    }

    // Call LINE Messaging API - Push Message
    await client.pushMessage(to, messages);

    return NextResponse.json({ 
      status: 'success', 
      message: 'Message sent successfully to LINE.' 
    });

  } catch (error: unknown) {
    console.error('LINE Messaging API Push Error:', error);

    const status =
      typeof error === 'object' && error !== null && 'statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 500;
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';

    return NextResponse.json({ 
      error: 'Failed to send message via LINE', 
      details: errorMessage 
    }, { status });
  }
}
