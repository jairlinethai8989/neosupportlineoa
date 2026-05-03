import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getDefaultReportBroadcastSettings,
  getReportBroadcastSettings,
  normalizeBroadcastSettings,
  saveReportBroadcastSettings,
} from '@/lib/reports/broadcastSettings';

async function requireStaffAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || (profile.role !== 'Agent' && profile.role !== 'Administrator')) return null;
  return { user, profile };
}

export async function GET() {
  try {
    const auth = await requireStaffAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const settings = await getReportBroadcastSettings();
    const { data: groups, error } = await supabaseAdmin
      .from('line_groups')
      .select('id, name, group_id, is_active')
      .order('name');
    if (error) throw error;

    return NextResponse.json({
      settings,
      groups: (groups || []).filter((g) => g.is_active),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load settings';
    // Handle missing migration gracefully so UI still opens
    if (message.includes('report_broadcast_')) {
      return NextResponse.json({ settings: getDefaultReportBroadcastSettings(), groups: [] });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireStaffAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const settings = normalizeBroadcastSettings(body?.settings);
    await saveReportBroadcastSettings(settings);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
