import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildVersionedLiveCacheKey,
  getOrSetLiveCache,
  readLiveCache,
} from '@/lib/cache/liveCache';
import { CACHE_POLICY } from '@/lib/cache/policy';

type DashboardTicketRow = {
  status: string | null;
  priority: string | null;
  created_at: string;
  updated_at: string | null;
  assigned_agent_id: string | null;
  hospitals?: { name: string | null } | { name: string | null }[] | null;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
};

type DashboardLogRow = {
  id: string;
  ticket_id: string;
  action_type: string | null;
  note: string | null;
  created_at: string;
  tickets: { ticket_no: string | null } | { ticket_no: string | null }[] | null;
};

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function getDateKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromDate = parseIsoDate(searchParams.get('from'));
    const toDate = parseIsoDate(searchParams.get('to'));
    const includeLogs = searchParams.get('includeLogs') === '1';

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
    const cacheKey = buildVersionedLiveCacheKey(`dashboard:${fromIso}:${toIso}:logs=${includeLogs ? '1' : '0'}`);
    const cacheHitBeforeLoad = readLiveCache(cacheKey) !== null;
    const ttlMs = includeLogs
      ? CACHE_POLICY.live.dashboardSummaryWithLogsTtlMs
      : CACHE_POLICY.live.dashboardSummaryTtlMs;

    const payload = await getOrSetLiveCache(cacheKey, ttlMs, async () => {
      // 1. Fetch Aggregated Data via RPC
      const { data: rpcData, error: rpcError } = await supabaseAdmin
        .rpc('get_dashboard_summary', {
          p_start_date: fromIso,
          p_end_date: toIso
        });

      if (rpcError) {
        throw new Error(`RPC Error: ${rpcError.message}`);
      }

      // If the RPC fails or returns null for some reason, provide defaults
      const rawPayload = rpcData || {
        stats: { totalToday: 0, yesterdayCount: 0, newTickets: 0, inProgress: 0, pending: 0, escalated: 0, resolved: 0, totalAll: 0 },
        statusData: [], priorityData: [], hospitalData: [], agentData: [], createdCountsByDay: {}, resolvedCountsByDay: {}
      };

      const { stats, statusData, priorityData, hospitalData, agentData, createdCountsByDay, resolvedCountsByDay } = rawPayload as any;

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
        },
        trendByDay,
        statusData,
        priorityData,
        hospitalData,
        agentData,
        recentLogs,
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
