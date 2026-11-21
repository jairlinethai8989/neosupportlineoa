import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { CACHE_POLICY } from '@/lib/cache/policy';
import { resolveScopedProjectIds } from '@/lib/projects/projectAccess';
import {
  EMPTY_DASHBOARD_SUMMARY,
  getDashboardSummaryData,
} from '@/lib/server/dashboardSummary';

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromDate = parseIsoDate(searchParams.get('from'));
    const toDate = parseIsoDate(searchParams.get('to'));
    const includeLogs = searchParams.get('includeLogs') === '1';

    const organizationId = searchParams.get('organizationId') || '';
    const moduleFilter = searchParams.get('module') || '';
    const issueType = searchParams.get('issueType') || '';
    const requestedProjectId = searchParams.get('projectId') || '';

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'Invalid from/to datetime.' }, { status: 400 });
    }

    const profileBypassAuth =
      process.env.NODE_ENV !== 'production' &&
      process.env.PROFILE_BYPASS_AUTH === '1';

    let scopedProjectIds: string[] | null = null;
    if (!profileBypassAuth) {
      const supabaseServer = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabaseServer.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      try {
        const resolved = await resolveScopedProjectIds(user.id, requestedProjectId || null);
        scopedProjectIds = resolved.projectIds;
      } catch {
        return NextResponse.json({ error: 'Forbidden project scope' }, { status: 403 });
      }
    }

    if (Array.isArray(scopedProjectIds) && scopedProjectIds.length === 0) {
      return NextResponse.json(EMPTY_DASHBOARD_SUMMARY);
    }

    const { payload, cacheHit } = await getDashboardSummaryData({
      fromIso: fromDate.toISOString(),
      toIso: toDate.toISOString(),
      includeLogs,
      organizationId,
      moduleFilter,
      issueType,
      scopedProjectIds,
    });

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': CACHE_POLICY.live.dashboardSummaryCacheControl,
        'x-live-cache': cacheHit ? 'hit' : 'miss',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
