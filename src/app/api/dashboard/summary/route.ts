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
  assigned_to: string | null;
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
      const ticketSelect = `
        status,
        priority,
        created_at,
        updated_at,
        assigned_to
      `;

      const { data: ticketsData, error: ticketsError } = await supabaseAdmin
        .from('tickets')
        .select(ticketSelect)
        .gte('created_at', fromIso)
        .lte('created_at', toIso);

      if (ticketsError) {
        throw new Error(ticketsError.message);
      }

      const tickets = (ticketsData || []) as DashboardTicketRow[];
      let logs: DashboardLogRow[] = [];

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

        if (logsError) {
          throw new Error(logsError.message);
        }
        logs = (logsData || []) as DashboardLogRow[];
      }

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      let totalToday = 0;
      let yesterdayCount = 0;
      let newTickets = 0;
      let inProgress = 0;
      let pending = 0;
      let escalated = 0;
      let resolved = 0;

      const statusCounts: Record<string, number> = {};
      const priorityCounts: Record<string, number> = {};
      const agentCounts: Record<string, number> = {};
      const createdCountsByDay: Record<string, number> = {};
      const resolvedCountsByDay: Record<string, number> = {};

      for (const ticket of tickets) {
        const status = ticket.status || '';
        const priority = ticket.priority || 'Medium';
        const createdAt = new Date(ticket.created_at);
        const createdDateKey = getDateKeyFromIso(ticket.created_at);

        if (createdAt >= todayStart) totalToday += 1;
        if (createdAt >= yesterdayStart && createdAt < todayStart) yesterdayCount += 1;

        if (status === 'New') newTickets += 1;
        else if (status === 'In Progress') inProgress += 1;
        else if (status === 'Pending') pending += 1;
        else if (status === 'Escalated') escalated += 1;
        else if (status === 'Resolved' || status === 'Closed') resolved += 1;

        statusCounts[status] = (statusCounts[status] || 0) + 1;
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
        createdCountsByDay[createdDateKey] = (createdCountsByDay[createdDateKey] || 0) + 1;

        if (ticket.assigned_to) {
          agentCounts[ticket.assigned_to] = (agentCounts[ticket.assigned_to] || 0) + 1;
        }

        if ((status === 'Resolved' || status === 'Closed') && ticket.updated_at) {
          const resolvedDateKey = getDateKeyFromIso(ticket.updated_at);
          resolvedCountsByDay[resolvedDateKey] = (resolvedCountsByDay[resolvedDateKey] || 0) + 1;
        }
      }

      const trendPct =
        yesterdayCount > 0 ? Math.round(((totalToday - yesterdayCount) / yesterdayCount) * 100) : null;

      const trendByDay = Object.keys(createdCountsByDay)
        .concat(Object.keys(resolvedCountsByDay))
        .filter((value, index, arr) => arr.indexOf(value) === index)
        .sort()
        .map((dateKey) => ({
          dateKey,
          created: createdCountsByDay[dateKey] || 0,
          resolved: resolvedCountsByDay[dateKey] || 0,
        }));

      const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
      const priorityData = Object.entries(priorityCounts).map(([name, value]) => ({ name, value }));
      const agentData = Object.entries(agentCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));

      const recentLogs = logs.map((log) => ({
        action_type: log.action_type || '',
        note: log.note || '',
        created_at: log.created_at,
        tickets: { ticket_no: toObject(log.tickets)?.ticket_no || '' },
      }));

      return {
        stats: {
          totalToday,
          newTickets,
          inProgress,
          pending,
          escalated,
          resolved,
          totalAll: tickets.length,
          trendPct,
        },
        trendByDay,
        statusData,
        priorityData,
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
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
