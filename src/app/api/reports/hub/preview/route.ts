import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import * as line from '@line/bot-sdk';

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
  hospitals: { name: string | null } | { name: string | null }[] | null;
};

function parseDateParam(value: string | null): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function buildDayRangeUtc(ymd: string) {
  return {
    startIso: `${ymd}T00:00:00.000Z`,
    endIso: `${ymd}T23:59:59.999Z`,
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

    const hospitalNode = Array.isArray(row.hospitals) ? row.hospitals[0] : row.hospitals;
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

    const cacheKey = buildVersionedPreviewCacheKey(`hub:${date}`);
    const cacheHitBeforeLoad = readPreviewCache(cacheKey) !== null;
    const summary = await getOrSetPreviewCache(
      cacheKey,
      CACHE_POLICY.reports.hubPreviewTtlMs,
      async () => {
      const { startIso, endIso } = buildDayRangeUtc(date);
      const ticketPreviewSelect = 'id, status, hospitals(name)';

      const orFilter = [
        `and(created_at.gte."${startIso}",created_at.lte."${endIso}")`,
        `and(resolved_at.gte."${startIso}",resolved_at.lte."${endIso}")`,
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
        hospitals: Array.isArray(row.hospitals) ? row.hospitals[0] || null : row.hospitals,
      }));
      
      // Fetch target group names from database
      let targetGroupName = '';
      try {
        const { data: groups } = await supabaseAdmin
          .from('line_groups')
          .select('name')
          .eq('is_active', true);
        
        if (groups && groups.length > 0) {
          targetGroupName = groups.map(g => g.name).join(', ');
        }
      } catch (e) {
        console.error('Failed to query line_groups table:', e);
      }

      // Fallback if table doesn't exist or is empty
      if (!targetGroupName) {
        targetGroupName = 'NEO Support (Default)';
        const groupId = process.env.LINE_GROUP_ID;
        if (groupId) {
          try {
            const client = new line.Client({
              channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
              channelSecret: process.env.LINE_CHANNEL_SECRET || '',
            });
            const groupSummary = await client.getGroupSummary(groupId);
            targetGroupName = groupSummary.groupName;
          } catch (e) {
            console.error('Failed to fetch LINE group name:', e);
          }
        }
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
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
