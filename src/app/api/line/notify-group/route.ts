/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { sendLineGroupNotification, sendLineGroupFlexNotification } from '@/lib/utils/lineNotifications';

/**
 * API Route: Send notification to the internal LINE staff group
 * 
 * POST /api/line/notify-group
 * Body: { message: string } — plain text
 *   OR: { altText: string, contents: object } — Flex Message
 * 
 * Used by: ticket lifecycle events (new ticket, SLA breach, escalation)
 */
export async function POST(req: NextRequest) {
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

  } catch (error: any) {
    console.error('Notify Group Error:', error);
    return NextResponse.json({ 
      error: 'Failed to send group notification', 
      details: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}
