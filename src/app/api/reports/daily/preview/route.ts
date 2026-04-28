import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getTicketSubjectOnly } from '@/lib/reports/subject';
import {
  buildVersionedPreviewCacheKey,
  getOrSetPreviewCache,
  readPreviewCache,
} from '@/lib/reports/previewCache';
import { shouldExposeReportsCacheDebugHeaders } from '@/lib/reports/cacheDebug';
import { CACHE_POLICY } from '@/lib/cache/policy';

type RawTicket = {
  id: string;
  status: string | null;
  created_at: string;
  resolved_at: string | null;
  subject: string | null;
  description: string | null;
  resolution_summary: string | null;
  source: string | null;
  module: string | null;
  issue_type: string | null;
  priority: string | null;
  hospitals: { name: string | null } | { name: string | null }[] | null;
  customers:
    | {
        display_name: string | null;
        hospitals: { name: string | null } | { name: string | null }[] | null;
      }
    | {
        display_name: string | null;
        hospitals: { name: string | null } | { name: string | null }[] | null;
      }[]
    | null;
  assigned_agent: { display_name: string | null } | { display_name: string | null }[] | null;
};

type DailyPreviewRow = {
  id: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  subject_only: string;
  description: string;
  resolution_summary: string;
  source: string;
  module: string;
  issue_type: string;
  priority: string;
  hospital_name: string;
  customer_name: string;
  assignee_name: string;
  duration_ms: number;
};

function parseDateParam(value: string | null): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function toObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function getDurationMs(start: string, end: string | null): number {
  if (!end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return diff > 0 ? diff : 0;
}

function normalizeRow(row: RawTicket): DailyPreviewRow {
  const hospital = toObject(row.hospitals);
  const customer = toObject(row.customers);
  const customerHospital = toObject(customer?.hospitals || null);
  const assignee = toObject(row.assigned_agent);

  return {
    id: row.id,
    status: row.status || '',
    created_at: row.created_at,
    resolved_at: row.resolved_at,
    subject_only: getTicketSubjectOnly(row.subject, row.description),
    description: row.description || '',
    resolution_summary: row.resolution_summary || '',
    source: row.source || '',
    module: row.module || '',
    issue_type: row.issue_type || '',
    priority: row.priority || '',
    hospital_name: hospital?.name || customerHospital?.name || '',
    customer_name: customer?.display_name || '',
    assignee_name: assignee?.display_name || '',
    duration_ms: getDurationMs(row.created_at, row.resolved_at),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = parseDateParam(searchParams.get('start'));
    const end = parseDateParam(searchParams.get('end'));

    if (!start || !end) {
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

    const cacheKey = buildVersionedPreviewCacheKey(`daily:${start}:${end}`);
    const cacheHitBeforeLoad = readPreviewCache(cacheKey) !== null;
    const payload = await getOrSetPreviewCache(
      cacheKey,
      CACHE_POLICY.reports.dailyPreviewTtlMs,
      async () => {
      const startIso = `${start}T00:00:00.000Z`;
      const endIso = `${end}T23:59:59.999Z`;

      const reportTicketSelect = `
        id,
        status,
        created_at,
        resolved_at,
        subject,
        description,
        resolution_summary,
        source,
        module,
        issue_type,
        priority,
        hospitals!tickets_hospital_id_fkey ( name ),
        customers!tickets_customer_id_fkey (
          display_name,
          hospitals!hospital_id ( name )
        ),
        assigned_agent:profiles!assigned_agent_id( display_name:full_name )
      `;

      const { data, error } = await supabaseAdmin
        .from('tickets')
        .select(reportTicketSelect)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const rows = ((data || []) as RawTicket[]).map(normalizeRow);
      return { rows };
      }
    );

    const headers: Record<string, string> = {
      'Cache-Control': CACHE_POLICY.reports.dailyResponseCacheControl,
    };
    if (shouldExposeReportsCacheDebugHeaders()) {
      headers['x-cache'] = cacheHitBeforeLoad ? 'hit' : 'miss';
      headers['x-cache-key'] = cacheKey;
    }
    return NextResponse.json(payload, { headers });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
