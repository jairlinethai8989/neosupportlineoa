import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getUserProjectScope } from '@/lib/projects/projectAccess';

export async function GET() {
  try {
    const supabaseServer = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scope = await getUserProjectScope(user.id);
    return NextResponse.json({
      isAdmin: scope.isAdmin,
      projects: scope.projects,
      projectIds: scope.projectIds,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load user projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
