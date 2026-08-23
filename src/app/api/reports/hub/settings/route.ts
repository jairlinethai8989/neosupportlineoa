import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getStaffAuth } from '@/lib/auth/staffAuthorization';
import {
  getDefaultReportBroadcastSettings,
  getReportBroadcastSettings,
  isReportBroadcastSchemaReady,
  normalizeBroadcastSettings,
  saveReportBroadcastSettings,
} from '@/lib/reports/broadcastSettings';

export async function GET() {
  try {
    const auth = await getStaffAuth({ permission: 'reports', level: 'view' });
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('line_groups')
      .select('id, name, group_id, is_active')
      .order('name');
    if (groupsError) throw groupsError;

    let settings = getDefaultReportBroadcastSettings();
    let schemaReady = true;
    try {
      settings = await getReportBroadcastSettings();
      schemaReady = await isReportBroadcastSchemaReady();
    } catch (settingsError) {
      console.error('Failed to load report broadcast settings:', settingsError);
      schemaReady = false;
    }

    return NextResponse.json({
      settings,
      schemaReady,
      groups: (groups || []).filter((g) => g.is_active),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getStaffAuth({ permission: 'reports', level: 'edit' });
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
