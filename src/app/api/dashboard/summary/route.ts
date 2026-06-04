/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildVersionedLiveCacheKey,
  getOrSetLiveCache,
  readLiveCache,
} from '@/lib/cache/liveCache';
import { CACHE_POLICY } from '@/lib/cache/policy';

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
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

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'Invalid from/to datetime.' }, { status: 400 });
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

    const fromIso = fromDate.toISOString();
    const toIso = toDate.toISOString();
    const cacheKey = buildVersionedLiveCacheKey(`dashboard:${fromIso}:${toIso}:logs=${includeLogs ? '1' : '0'}:hosp=${organizationId}:mod=${moduleFilter}:type=${issueType}`);
    const cacheHitBeforeLoad = readLiveCache(cacheKey) !== null;
    const ttlMs = includeLogs
      ? CACHE_POLICY.live.dashboardSummaryWithLogsTtlMs
      : CACHE_POLICY.live.dashboardSummaryTtlMs;

    const payload = await getOrSetLiveCache(cacheKey, ttlMs, async () => {
      // 1. Fetch Aggregated Data via RPC
      const { data: rpcData, error: rpcError } = await supabaseAdmin
        .rpc('get_dashboard_summary', {
          p_start_date: fromIso,
          p_end_date: toIso,
          p_organization_id: organizationId || null,
          p_module: moduleFilter || null,
          p_issue_type: issueType || null
        });

      if (rpcError) {
        throw new Error(`RPC Error: ${rpcError.message}`);
      }

      // If the RPC returns a string (PostgREST behavior), parse it first
      const parsed = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
      const rawPayload = parsed || {
        stats: { totalToday: 0, yesterdayCount: 0, newTickets: 0, inProgress: 0, pending: 0, escalated: 0, resolved: 0, totalAll: 0, avgCsat: 0.0 },
        statusData: [], priorityData: [], organizationData: [], agentData: [],
        createdCountsByDay: {}, resolvedCountsByDay: {}, heatmapData: [],
      };

      const { stats, statusData, priorityData, organizationData, agentData, createdCountsByDay, resolvedCountsByDay, heatmapData } = rawPayload as any;

      // Calculate Trend Percentage
      const trendPct = stats.yesterdayCount > 0 
        ? Math.round(((stats.totalToday - stats.yesterdayCount) / stats.yesterdayCount) * 100) 
        : null;

      // Merge and sort dates for trend chart
      const trendDates = new Set([...Object.keys(createdCountsByDay || {}), ...Object.keys(resolvedCountsByDay || {})]);
      const trendByDay = Array.from(trendDates)
        .sort()
        .map((dateKey) => ({
          dateKey,
          created: createdCountsByDay[dateKey] || 0,
          resolved: resolvedCountsByDay[dateKey] || 0,
        }));

      // 2. Fetch Recent Logs (only if requested)
      let recentLogs: any[] = [];
      if (includeLogs) {
        const ticketLogSelect = `
          id,
          ticket_id,
          action_type,
          note,
          created_at,
          tickets(ticket_no)
        `;
        const { data: logsData, error: logsError } = await supabaseAdmin
          .from('ticket_logs')
          .select(ticketLogSelect)
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false })
          .limit(10);

        if (logsError) throw new Error(logsError.message);
        
        recentLogs = (logsData || []).map((log: any) => ({
          action_type: log.action_type || '',
          note: log.note || '',
          created_at: log.created_at,
          tickets: { ticket_no: toObject(log.tickets)?.ticket_no || '' },
        }));
      }

      // 3. Build Heatmap matrix from RPC-aggregated rows (max 168 rows, not 10,000)
      const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
      if (Array.isArray(heatmapData)) {
        (heatmapData as Array<{ dow: number; hour: number; cnt: number }>).forEach(({ dow, hour, cnt }) => {
          if (dow >= 0 && dow <= 6 && hour >= 0 && hour <= 23) {
            heatmap[dow][hour] = cnt;
          }
        });
      }

      return {
        stats: {
          totalToday: stats.totalToday,
          newTickets: stats.newTickets,
          inProgress: stats.inProgress,
          pending: stats.pending,
          escalated: stats.escalated,
          resolved: stats.resolved,
          totalAll: stats.totalAll,
          trendPct,
          avgCsat: stats.avgCsat || 0.0,
        },
        trendByDay,
        statusData,
        priorityData,
        organizationData,
        agentData,
        recentLogs,
        heatmap,
      };
    });

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': CACHE_POLICY.live.dashboardSummaryCacheControl,
        'x-live-cache': cacheHitBeforeLoad ? 'hit' : 'miss',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
