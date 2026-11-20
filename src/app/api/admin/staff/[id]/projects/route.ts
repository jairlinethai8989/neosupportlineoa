import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { auditService } from '@/lib/services/auditService';

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: staffId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: requesterProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, permissions')
      .eq('id', user.id)
      .maybeSingle();

    const canManageStaff =
      requesterProfile?.role === 'Administrator' ||
      requesterProfile?.permissions?.settings_staff === 'edit';

    if (!canManageStaff) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const projectIds: string[] = Array.isArray(body.projectIds)
      ? body.projectIds.filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0)
      : [];

    // Replace memberships atomically for this staff user
    const { error: delError } = await supabaseAdmin
      .from('project_members')
      .delete()
      .eq('profile_id', staffId);

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    if (projectIds.length > 0) {
      const rows = Array.from(new Set(projectIds)).map((projectId) => ({
        project_id: projectId,
        profile_id: staffId,
        project_role: 'agent',
      }));
      const { error: insError } = await supabaseAdmin.from('project_members').insert(rows);
      if (insError) {
        return NextResponse.json({ error: insError.message }, { status: 500 });
      }
    }

    await auditService.log(
      {
        performer_id: user.id,
        action_type: 'STAFF_PROJECT_SCOPE_UPDATE',
        entity_type: 'PROFILE',
        entity_id: staffId,
        new_data: { projectIds },
        note: `Updated assigned projects (${projectIds.length}) for staff ${staffId}`,
      },
      supabaseAdmin
    );

    return NextResponse.json({ success: true, projectIds });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update staff projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
