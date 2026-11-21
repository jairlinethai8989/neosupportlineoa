import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getDashboardBootstrapForUser } from '@/lib/server/dashboardBootstrap';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedProjectId = searchParams.get('projectId') || null;

    const supabaseServer = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await getDashboardBootstrapForUser(user.id, requestedProjectId);
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load bootstrap data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
