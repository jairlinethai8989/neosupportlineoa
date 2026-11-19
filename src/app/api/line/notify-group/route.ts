import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendLineGroupNotification, sendLineGroupFlexNotification } from '@/lib/utils/lineNotifications';

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
 * API Route: Send notification to the internal LINE staff group
 * 
 * POST /api/line/notify-group
 * Body: { message: string } — plain text
 *   OR: { altText: string, contents: object } — Flex Message
 * 
 * Used by: ticket lifecycle events (new ticket, SLA breach, escalation)
 */
export async function POST(req: Request) {
  // 1. Auth Guard — only logged-in agents can send group notifications
  const { user, error: authError } = await getAuthenticatedUser();
  if (!user || authError) {
    console.warn('Notify Group API: Unauthorized request rejected');
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Flex Message mode
    if (body.altText && body.contents) {
      await sendLineGroupFlexNotification(body.altText, body.contents);
      return NextResponse.json({ 
        status: 'success', 
        type: 'flex',
        message: 'Flex notification sent to LINE group.' 
      });
    }

    // Plain text mode
    if (body.message && typeof body.message === 'string') {
      await sendLineGroupNotification(body.message);
      return NextResponse.json({ 
        status: 'success', 
        type: 'text',
        message: 'Text notification sent to LINE group.' 
      });
    }

    return NextResponse.json({ 
      error: 'Invalid request. Provide { message: string } or { altText: string, contents: object }.' 
    }, { status: 400 });

  } catch (error: unknown) {
    console.error('Notify Group Error:', error);
    return NextResponse.json({ 
      error: 'Failed to send group notification', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
