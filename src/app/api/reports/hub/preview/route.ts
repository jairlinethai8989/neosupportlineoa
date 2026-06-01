import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getReportBroadcastSettings } from '@/lib/reports/broadcastSettings';

import {
  buildVersionedPreviewCacheKey,
  getOrSetPreviewCache,
  readPreviewCache,
} from '@/lib/reports/previewCache';
import { shouldExposeReportsCacheDebugHeaders } from '@/lib/reports/cacheDebug';
import { CACHE_POLICY } from '@/lib/cache/policy';

type PreviewTicketRow = {
  id: string;
  status: string;
  organizations: { name: string | null } | { name: string | null }[] | null;
};

function parseDateParam(value: string | null): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function buildDayRangeUtc(ymd: string) {
  return {
    startIso: `${ymd}T00:00:00.000+07:00`,
    endIso: `${ymd}T23:59:59.999+07:00`,
  };
}

function buildPreviewSummary(rows: PreviewTicketRow[]) {
  const hospitalGroups: Record<string, number> = {};

  let unresolvedCount = 0;
  let resolvedCount = 0;

  for (const row of rows) {
    if (row.status === 'Resolved' || row.status === 'Closed') {
      resolvedCount += 1;
    } else {
      unresolvedCount += 1;
    }

    const hospitalNode = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    const hospitalName = hospitalNode?.name || '';
    hospitalGroups[hospitalName] = (hospitalGroups[hospitalName] || 0) + 1;
  }

  return {
    total: rows.length,
    newProgress: unresolvedCount,
    resolved: resolvedCount,
    hospitalGroups,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = parseDateParam(searchParams.get('date'));

    if (!date) {
      return NextResponse.json({ error: 'Invalid date format. Expected yyyy-MM-dd.' }, { status: 400 });
    }

    const profileBypassAuth =
      process.env.NODE_ENV !== 'production' &&
      process.env.PROFILE_BYPASS_AUTH === '1';

    if (!profileBypassAuth) {
      const supabaseServer = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabaseServer.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const cacheKey = buildVersionedPreviewCacheKey(`hub:v2:${date}`);
    const cacheHitBeforeLoad = readPreviewCache(cacheKey) !== null;
    const summary = await getOrSetPreviewCache(
      cacheKey,
      CACHE_POLICY.reports.hubPreviewTtlMs,
      async () => {
      const { startIso, endIso } = buildDayRangeUtc(date);
      const ticketPreviewSelect = 'id, status, organizations(name)';

      const orFilter = [
        `and(created_at.gte.${startIso},created_at.lte.${endIso})`,
        `and(resolved_at.gte.${startIso},resolved_at.lte.${endIso})`,
      ].join(',');

      const { data, error } = await supabaseAdmin
        .from('tickets')
        .select(ticketPreviewSelect)
        .or(orFilter)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const rows = ((data || []) as PreviewTicketRow[]).map((row) => ({
        ...row,
        organizations: Array.isArray(row.organizations) ? row.organizations[0] || null : row.organizations,
      }));
      
      let targetGroupName = '';
      const broadcast = await getReportBroadcastSettings();
      if (broadcast.groupId) {
        const { data: selectedGroup } = await supabaseAdmin
          .from('line_groups')
          .select('name')
          .eq('group_id', broadcast.groupId)
          .eq('is_active', true)
          .maybeSingle();
        targetGroupName = selectedGroup?.name || '';
      }

      return {
        ...buildPreviewSummary(rows),
        targetGroupName,
      };
      }
    );

    const headers: Record<string, string> = {
      'Cache-Control': CACHE_POLICY.reports.hubResponseCacheControl,
    };
    if (shouldExposeReportsCacheDebugHeaders()) {
      headers['x-cache'] = cacheHitBeforeLoad ? 'hit' : 'miss';
      headers['x-cache-key'] = cacheKey;
    }
    return NextResponse.json(summary, { headers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
