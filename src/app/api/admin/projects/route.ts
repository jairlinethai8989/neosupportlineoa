import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateProjectResolverCache } from '@/lib/projects/projectResolver';
import { invalidateAllLiveCaches } from '@/lib/cache/liveCache';
import { sendLineGroupNotification } from '@/lib/utils/lineNotifications';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'Administrator') {
    return { error: NextResponse.json({ error: 'Forbidden: Administrators only' }, { status: 403 }) };
  }

  return { userId: user.id };
}

function sanitizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const [{ data: projects, error }, { data: members }] = await Promise.all([
      supabaseAdmin
        .from('projects')
        .select(
          'id, slug, name, code, organization_label, logo_url, primary_color, line_channel_id, line_channel_secret, line_channel_access_token, line_liff_id, line_bot_id, line_staff_group_id, notify_on_customer_message, is_default, is_active, created_at'
        )
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true }),
      supabaseAdmin.from('project_members').select('project_id, profile_id, project_role'),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const membersByProject = new Map<string, Array<{ profile_id: string; project_role: string }>>();
    for (const m of members || []) {
      const list = membersByProject.get(m.project_id) || [];
      list.push({ profile_id: m.profile_id, project_role: m.project_role });
      membersByProject.set(m.project_id, list);
    }

    const sanitized = (projects || []).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      code: p.code,
      organization_label: p.organization_label,
      logo_url: p.logo_url,
      primary_color: p.primary_color,
      line_channel_id: p.line_channel_id,
      line_liff_id: p.line_liff_id,
      line_bot_id: p.line_bot_id,
      line_staff_group_id: p.line_staff_group_id,
      notify_on_customer_message: Boolean(p.notify_on_customer_message),
      is_default: Boolean(p.is_default),
      is_active: Boolean(p.is_active),
      has_line_secret: Boolean(p.line_channel_secret),
      has_line_token: Boolean(p.line_channel_access_token),
      member_count: membersByProject.get(p.id)?.length || 0,
      members: membersByProject.get(p.id) || [],
    }));

    return NextResponse.json({ projects: sanitized });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();

    if (body.action === 'test-group') {
      const projectId = String(body.projectId || '').trim();
      const groupId = String(body.line_staff_group_id || '').trim();
      if (!projectId || !groupId) {
        return NextResponse.json(
          { error: 'กรุณาระบุโครงการและ LINE Group ID ก่อนทดสอบส่งข้อความ' },
          { status: 400 }
        );
      }
      const ok = await sendLineGroupNotification(
        `✅ ทดสอบการเชื่อมต่อ LINE กลุ่มเจ้าหน้าที่สำเร็จ (Project ID: ${projectId.slice(0, 8)})`,
        groupId,
        projectId
      );
      if (!ok) {
        return NextResponse.json(
          { error: 'ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบ Channel Access Token และ Group ID ของโครงการนี้' },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true });
    }

    const name = String(body.name || '').trim();
    const code = String(body.code || '').trim().toUpperCase();
    const slug = sanitizeSlug(String(body.slug || code || name));

    if (!name || !code || !slug) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อโครงการ, รหัสย่อ และ Slug' }, { status: 400 });
    }

    const insertRow: Record<string, unknown> = {
      name,
      code,
      slug,
      organization_label: String(body.organization_label || 'หน่วยงาน').trim() || 'หน่วยงาน',
      logo_url: body.logo_url?.trim() || null,
      primary_color: body.primary_color?.trim() || '#0066ff',
      line_channel_id: body.line_channel_id?.trim() || null,
      line_channel_secret: body.line_channel_secret?.trim() || null,
      line_channel_access_token: body.line_channel_access_token?.trim() || null,
      line_liff_id: body.line_liff_id?.trim() || null,
      line_bot_id: body.line_bot_id?.trim() || null,
      line_staff_group_id: body.line_staff_group_id?.trim() || null,
      notify_on_customer_message: Boolean(body.notify_on_customer_message),
      is_active: body.is_active !== false,
    };

    const { data: created, error } = await supabaseAdmin
      .from('projects')
      .insert([insertRow])
      .select('id, slug, name, code')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Auto-add creator admin into project_members as lead
    await supabaseAdmin
      .from('project_members')
      .upsert(
        [{ project_id: created.id, profile_id: auth.userId, project_role: 'lead' }],
        { onConflict: 'project_id,profile_id' }
      );

    invalidateProjectResolverCache();
    invalidateAllLiveCaches();
    return NextResponse.json({ success: true, project: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.name === 'string' && body.name.trim()) updateData.name = body.name.trim();
    if (typeof body.code === 'string' && body.code.trim()) updateData.code = body.code.trim().toUpperCase();
    if (typeof body.slug === 'string' && body.slug.trim()) updateData.slug = sanitizeSlug(body.slug);
    if (typeof body.organization_label === 'string') {
      updateData.organization_label = body.organization_label.trim() || 'หน่วยงาน';
    }
    if (body.logo_url !== undefined) updateData.logo_url = body.logo_url?.trim() || null;
    if (typeof body.primary_color === 'string' && body.primary_color.trim()) {
      updateData.primary_color = body.primary_color.trim();
    }
    if (body.line_channel_id !== undefined) updateData.line_channel_id = body.line_channel_id?.trim() || null;
    if (body.line_liff_id !== undefined) updateData.line_liff_id = body.line_liff_id?.trim() || null;
    if (body.line_bot_id !== undefined) updateData.line_bot_id = body.line_bot_id?.trim() || null;
    if (body.line_staff_group_id !== undefined) {
      updateData.line_staff_group_id = body.line_staff_group_id?.trim() || null;
    }
    if (typeof body.notify_on_customer_message === 'boolean') {
      updateData.notify_on_customer_message = body.notify_on_customer_message;
    }
    if (typeof body.is_active === 'boolean') {
      updateData.is_active = body.is_active;
    }

    // Only overwrite LINE secrets when non-empty values are explicitly submitted
    if (typeof body.line_channel_secret === 'string' && body.line_channel_secret.trim()) {
      updateData.line_channel_secret = body.line_channel_secret.trim();
    }
    if (
      typeof body.line_channel_access_token === 'string' &&
      body.line_channel_access_token.trim()
    ) {
      updateData.line_channel_access_token = body.line_channel_access_token.trim();
    }

    const { data: updated, error } = await supabaseAdmin
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select('id, slug, name, code')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    invalidateProjectResolverCache();
    invalidateAllLiveCaches();
    return NextResponse.json({ success: true, project: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
