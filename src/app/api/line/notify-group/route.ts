import { NextResponse } from 'next/server';
import { sendLineGroupNotification, sendLineGroupFlexNotification } from '@/lib/utils/lineNotifications';
import { getReportBroadcastSettings } from '@/lib/reports/broadcastSettings';
import { getStaffAuth } from '@/lib/auth/staffAuthorization';

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
  const auth = await getStaffAuth({ permission: 'notifications', level: 'edit' });
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized: Access denied.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const settings = await getReportBroadcastSettings();
    if (!settings.groupId) {
      return NextResponse.json({ error: 'No target LINE group configured in settings.' }, { status: 400 });
    }

    // Flex Message mode
    if (body.altText && body.contents) {
      await sendLineGroupFlexNotification(body.altText, body.contents, settings.groupId);
      return NextResponse.json({ 
        status: 'success', 
        type: 'flex',
        message: 'Flex notification sent to LINE group.' 
      });
    }

    // Plain text mode
    if (body.message && typeof body.message === 'string') {
      await sendLineGroupNotification(body.message, settings.groupId);
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
    const details = error instanceof Error ? error.message : 'Unknown error';
    console.error('Notify Group Error:', error);
    return NextResponse.json({ 
      error: 'Failed to send group notification', 
      details
    }, { status: 500 });
  }
}
