import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const supabaseClient = await createSupabaseServerClient();

    // 1. Verify requester is Admin
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'Administrator') {
      return NextResponse.json({ error: 'Only administrators can create staff' }, { status: 403 });
    }

    // 2. Parse request
    const body = await req.json();
    const { username, password, full_name, role, department } = body;

    if (!username || !password || !full_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Initialize Admin Client (Service Role)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const virtualEmail = `${username}@neo.local`;

    // 4. Create User in Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: virtualEmail,
      password: password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (createError) throw createError;

    // 5. Create Profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: newUser.user.id,
        full_name,
        email: virtualEmail,
        department,
        role,
        status: 'Active',
        avatar_url: `https://api.dicebear.com/7.x/notionists/svg?seed=${username}&backgroundColor=f1f5f9`
      }]);

    if (profileError) {
      // Cleanup auth user if profile fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw profileError;
    }

    // 6. Log the activity
    const { auditService } = await import('@/lib/services/auditService');
    await auditService.log({
      performer_id: user.id,
      action_type: 'STAFF_CREATE',
      entity_type: 'STAFF',
      entity_id: newUser.user.id,
      new_data: { 
        username, 
        full_name, 
        role, 
        department 
      },
      note: `Created new staff: ${full_name} (${role})`
    }, supabaseAdmin);

    return NextResponse.json({ success: true, user: newUser.user });
  } catch (err: any) {
    console.error('Staff creation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
