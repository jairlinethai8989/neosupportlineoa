import { NextResponse } from 'next/server';
import {
  sendLineGroupNotification,
  sendLineGroupFlexNotification,
} from '@/lib/utils/lineNotifications';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getReportBroadcastSettings } from '@/lib/reports/broadcastSettings';
import { resolveProjectById } from '@/lib/projects/projectResolver';

/**
 * API Route: Send notification to the internal LINE staff group (project-aware).
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
    const body = await req.json();
    const projectId: string | null = body.projectId || null;

    let targetGroupId: string | null = null;
    if (projectId) {
      const project = await resolveProjectById(projectId);
      targetGroupId = project?.line_staff_group_id || null;
    }

    if (!targetGroupId) {
      const settings = await getReportBroadcastSettings();
      targetGroupId = settings.groupId || null;
    }

    if (!targetGroupId) {
      return NextResponse.json({ error: 'No target LINE group configured in settings.' }, { status: 400 });
    }

    if (body.altText && body.contents) {
      await sendLineGroupFlexNotification(body.altText, body.contents, targetGroupId, projectId);
      return NextResponse.json({
        status: 'success',
        type: 'flex',
        message: 'Flex notification sent to LINE group.',
      });
    }

    if (body.message && typeof body.message === 'string') {
      await sendLineGroupNotification(body.message, targetGroupId, projectId);
      return NextResponse.json({
        status: 'success',
        type: 'text',
        message: 'Text notification sent to LINE group.',
      });
    }

    return NextResponse.json({
      error: 'Invalid request. Provide { message: string } or { altText: string, contents: object }.',
    }, { status: 400 });
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : 'Unknown error';
    console.error('Notify Group Error:', error);
    return NextResponse.json({
      error: 'Failed to send group notification',
      details,
    }, { status: 500 });
  }
}
