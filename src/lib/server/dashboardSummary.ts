/* eslint-disable @typescript-eslint/no-explicit-any */
import { unstable_cache } from 'next/cache';
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildVersionedLiveCacheKey,
  getOrSetLiveCache,
  readLiveCache,
} from '@/lib/cache/liveCache';
import { CACHE_POLICY } from '@/lib/cache/policy';

export interface DashboardSummaryQueryParams {
  fromIso: string;
  toIso: string;
  includeLogs: boolean;
  organizationId?: string;
  moduleFilter?: string;
  issueType?: string;
  scopedProjectIds: string[] | null;
}

export interface DashboardSummaryPayload {
  stats: {
    totalToday: number;
    newTickets: number;
    inProgress: number;
    pending: number;
    escalated: number;
    resolved: number;
    totalAll: number;
    trendPct: number | null;
    avgCsat: number;
  };
  trendByDay: Array<{ dateKey: string; created: number; resolved: number }>;
  statusData: Array<{ name: string; value: number }>;
  priorityData: Array<{ name: string; value: number }>;
  organizationData: Array<{ name: string; value: number }>;
  agentData: Array<{ name: string; value: number }>;
  recentLogs: Array<{
    action_type: string;
    note: string;
    created_at: string;
    tickets: { ticket_no: string };
  }>;
  heatmap: number[][];
}

export const EMPTY_DASHBOARD_SUMMARY: DashboardSummaryPayload = {
  stats: {
    totalToday: 0,
    newTickets: 0,
    inProgress: 0,
    pending: 0,
    escalated: 0,
    resolved: 0,
    totalAll: 0,
    trendPct: null,
    avgCsat: 0.0,
  },
  trendByDay: [],
  statusData: [],
  priorityData: [],
  organizationData: [],
  agentData: [],
  recentLogs: [],
  heatmap: [],
};

export function getDefaultBangkokWeekWindow(): { fromIso: string; toIso: string } {
  const bangkokNow = DateTime.now().setZone('Asia/Bangkok');
  const from = bangkokNow.minus({ days: 7 }).startOf('day').toUTC().toISO();
  const to = bangkokNow.endOf('day').toUTC().toISO();
  return {
    fromIso: from || new Date(Date.now() - 7 * 86_400_000).toISOString(),
    toIso: to || new Date().toISOString(),
  };
}

function toObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

async function computeDashboardSummaryUncached(
  params: DashboardSummaryQueryParams
): Promise<DashboardSummaryPayload> {
  const {
    fromIso,
    toIso,
    includeLogs,
    organizationId = '',
    moduleFilter = '',
    issueType = '',
    scopedProjectIds,
  } = params;

  const ticketLogSelect = scopedProjectIds
    ? `
      id,
      ticket_id,
      action_type,
      note,
      created_at,
      tickets!inner(ticket_no, project_id)
    `
    : `
      id,
      ticket_id,
      action_type,
      note,
      created_at,
      tickets(ticket_no)
    `;

  let logsQuery = includeLogs
    ? supabaseAdmin
        .from('ticket_logs')
        .select(ticketLogSelect)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false })
        .limit(10)
    : null;

  if (logsQuery && scopedProjectIds) {
    logsQuery = logsQuery.in('tickets.project_id', scopedProjectIds);
  }

  const [rpcRes, logsRes] = await Promise.all([
    supabaseAdmin.rpc('get_dashboard_summary', {
      p_start_date: fromIso,
      p_end_date: toIso,
      p_organization_id: organizationId || null,
      p_module: moduleFilter || null,
      p_issue_type: issueType || null,
      p_project_ids: scopedProjectIds,
    }),
    logsQuery ?? Promise.resolve({ data: null, error: null }),
  ]);

  if (rpcRes.error) {
    throw new Error(`RPC Error: ${rpcRes.error.message}`);
  }
  if (logsRes.error) {
    throw new Error(logsRes.error.message);
  }

  const parsed = typeof rpcRes.data === 'string' ? JSON.parse(rpcRes.data) : rpcRes.data;
  const rawPayload = parsed || {
    stats: {
      totalToday: 0,
      yesterdayCount: 0,
      newTickets: 0,
      inProgress: 0,
      pending: 0,
      escalated: 0,
      resolved: 0,
      totalAll: 0,
      avgCsat: 0.0,
    },
    statusData: [],
    priorityData: [],
    organizationData: [],
    agentData: [],
    createdCountsByDay: {},
    resolvedCountsByDay: {},
    heatmapData: [],
  };

  const {
    stats,
    statusData,
    priorityData,
    organizationData,
    agentData,
    createdCountsByDay,
    resolvedCountsByDay,
    heatmapData,
  } = rawPayload as any;

  const trendPct =
    stats.yesterdayCount > 0
      ? Math.round(((stats.totalToday - stats.yesterdayCount) / stats.yesterdayCount) * 100)
      : null;

  const trendDates = new Set([
    ...Object.keys(createdCountsByDay || {}),
    ...Object.keys(resolvedCountsByDay || {}),
  ]);
  const trendByDay = Array.from(trendDates)
    .sort()
    .map((dateKey) => ({
      dateKey,
      created: createdCountsByDay[dateKey] || 0,
      resolved: resolvedCountsByDay[dateKey] || 0,
    }));

  const recentLogs: DashboardSummaryPayload['recentLogs'] = includeLogs
    ? (logsRes.data || []).map((log: any) => ({
        action_type: log.action_type || '',
        note: log.note || '',
        created_at: log.created_at,
        tickets: { ticket_no: toObject(log.tickets)?.ticket_no || '' },
      }))
    : [];

  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  if (Array.isArray(heatmapData)) {
    (heatmapData as Array<{ dow: number; hour: number; cnt: number }>).forEach(
      ({ dow, hour, cnt }) => {
        if (dow >= 0 && dow <= 6 && hour >= 0 && hour <= 23) {
          heatmap[dow][hour] = cnt;
        }
      }
    );
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
}

const getCachedDashboardSummaryData = unstable_cache(
  async (serializedKey: string, params: DashboardSummaryQueryParams) => {
    void serializedKey;
    return computeDashboardSummaryUncached(params);
  },
  ['neo-dashboard-summary-v1'],
  { revalidate: 15, tags: ['dashboard-summary'] }
);

export async function getDashboardSummaryData(
  params: DashboardSummaryQueryParams
): Promise<{ payload: DashboardSummaryPayload; cacheHit: boolean }> {
  if (Array.isArray(params.scopedProjectIds) && params.scopedProjectIds.length === 0) {
    return { payload: EMPTY_DASHBOARD_SUMMARY, cacheHit: true };
  }

  const projectCacheSegment = params.scopedProjectIds
    ? params.scopedProjectIds.join(',')
    : 'all';
  const rawKey = `dashboard:${params.fromIso}:${params.toIso}:logs=${params.includeLogs ? '1' : '0'}:hosp=${params.organizationId || ''}:mod=${params.moduleFilter || ''}:type=${params.issueType || ''}:proj=${projectCacheSegment}`;
  const cacheKey = buildVersionedLiveCacheKey(rawKey);
  const cacheHitBeforeLoad = readLiveCache(cacheKey) !== null;
  const ttlMs = params.includeLogs
    ? CACHE_POLICY.live.dashboardSummaryWithLogsTtlMs
    : CACHE_POLICY.live.dashboardSummaryTtlMs;

  const payload = await getOrSetLiveCache(cacheKey, ttlMs, () =>
    getCachedDashboardSummaryData(rawKey, params)
  );

  return { payload, cacheHit: cacheHitBeforeLoad };
}
