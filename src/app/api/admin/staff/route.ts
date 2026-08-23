import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getStaffAuth } from '@/lib/auth/staffAuthorization';
import { parseStaffCreate, parseStaffId, parseStaffPermissionUpdate } from '@/lib/auth/staffManagement';
import { auditService } from '@/lib/services/auditService';

function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) return null;

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(req: Request) {
  try {
    const auth = await getStaffAuth({ roles: ['Administrator'] });
    if (!auth) {
      return NextResponse.json({ error: 'Only administrators can create staff' }, { status: 403 });
    }

    let input;
    try {
      input = parseStaffCreate(await req.json());
    } catch {
      return NextResponse.json({ error: 'Invalid staff account details' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration is incomplete' }, { status: 500 });
    }

    const virtualEmail = `${input.username}@neo.local`;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: virtualEmail,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });

    if (createError) {
      const code = (createError as { code?: string }).code;
      if (code === 'email_exists' || code === 'user_already_exists') {
        return NextResponse.json({ error: 'Username is already in use' }, { status: 409 });
      }
      throw createError;
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: newUser.user.id,
        full_name: input.fullName,
        email: virtualEmail,
        department: input.department,
        role: input.role,
        status: 'Active',
        avatar_url: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(input.username)}&backgroundColor=f1f5f9`,
      }]);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw profileError;
    }

    await auditService.log({
      performer_id: auth.user.id,
      action_type: 'STAFF_CREATE',
      entity_type: 'STAFF',
      entity_id: newUser.user.id,
      new_data: {
        username: input.username,
        full_name: input.fullName,
        role: input.role,
        department: input.department,
      },
      note: `Created new staff: ${input.fullName} (${input.role})`,
    }, supabaseAdmin);

    return NextResponse.json({ success: true, user: { id: newUser.user.id, email: virtualEmail } });
  } catch (err: unknown) {
    console.error('Staff creation error:', err);
    return NextResponse.json({ error: 'Unable to create staff account' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getStaffAuth({ roles: ['Administrator'] });
    if (!auth) {
      return NextResponse.json({ error: 'Only administrators can update staff permissions' }, { status: 403 });
    }

    let input;
    try {
      input = parseStaffPermissionUpdate(await req.json());
    } catch {
      return NextResponse.json({ error: 'Invalid permission update' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration is incomplete' }, { status: 500 });
    }

    const { data: previous, error: readError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, permissions')
      .eq('id', input.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!previous) return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 });

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ permissions: input.permissions, updated_at: new Date().toISOString() })
      .eq('id', input.id);
    if (updateError) throw updateError;

    await auditService.log({
      performer_id: auth.user.id,
      action_type: 'STAFF_PERMISSION_UPDATE',
      entity_type: 'PROFILE',
      entity_id: input.id,
      old_data: { permissions: previous.permissions },
      new_data: { permissions: input.permissions },
      note: `Updated permissions for ${previous.full_name || input.id}`,
    }, supabaseAdmin);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Staff permission update error:', error);
    return NextResponse.json({ error: 'Unable to update staff permissions' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await getStaffAuth({ roles: ['Administrator'] });
    if (!auth) {
      return NextResponse.json({ error: 'Only administrators can delete staff' }, { status: 403 });
    }

    let id: string;
    try {
      id = parseStaffId(await req.json());
    } catch {
      return NextResponse.json({ error: 'Invalid staff id' }, { status: 400 });
    }
    if (id === auth.user.id) {
      return NextResponse.json({ error: 'Administrators cannot delete their own account' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration is incomplete' }, { status: 500 });
    }

    const { data: previous, error: readError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw readError;
    if (!previous) return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 });

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (deleteError) throw deleteError;

    await auditService.log({
      performer_id: auth.user.id,
      action_type: 'STAFF_DELETE',
      entity_type: 'PROFILE',
      entity_id: id,
      old_data: { full_name: previous.full_name, role: previous.role },
      note: `Deleted staff member: ${previous.full_name || id}`,
    }, supabaseAdmin);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Staff deletion error:', error);
    return NextResponse.json({ error: 'Unable to delete staff' }, { status: 500 });
  }
}
