import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getTicketSubjectOnly } from '@/lib/reports/subject';

export const runtime = 'nodejs';

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

function parseDateParam(value: string | null): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function toObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function getDurationStr(start: string, end: string | null): string {
  if (!end) return '-';
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return '-';
  const mins = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(mins / 60);
  const m = mins % 60;
  if (hours > 0) return `${hours}h ${m}m`;
  return `${m}m`;
}

function normalizeExportRow(row: RawTicket) {
  const hospital = toObject(row.hospitals);
  const customer = toObject(row.customers);
  const customerHospital = toObject(customer?.hospitals || null);
  const assignee = toObject(row.assigned_agent);

  const createdAt = new Date(row.created_at);
  const resolvedAt = row.resolved_at ? new Date(row.resolved_at) : null;

  return {
    Status: row.status || '',
    Date: createdAt.toLocaleDateString('th-TH'),
    Hospital: hospital?.name || customerHospital?.name || '',
    Customer: customer?.display_name || '',
    Subject: getTicketSubjectOnly(row.subject, row.description),
    'Additional Details': row.description || '',
    Resolution: row.resolution_summary || '',
    Assignee: assignee?.display_name || '',
    Source: row.source || '',
    Module: row.module || '',
    Type: row.issue_type || row.priority || '',
    'Created Time': createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    'Resolved Time': resolvedAt
      ? resolvedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : '-',
    'Time Used': getDurationStr(row.created_at, row.resolved_at),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const start = parseDateParam(body.start);
    const end = parseDateParam(body.end);
    const targetUrl = body.targetUrl;

    if (!start || !end) {
      return NextResponse.json({ error: 'Invalid date format. Expected yyyy-MM-dd.' }, { status: 400 });
    }
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid Google Sheets Web App URL.' }, { status: 400 });
    }

    const supabaseServer = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    if (error) throw new Error(error.message);

    const rows = ((data || []) as RawTicket[]).map(normalizeExportRow);

    if (rows.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No tickets found for the selected date range.' });
    }

    // Forward the payload to the Google Apps Script Web App
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rows }),
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script responded with status: ${response.status}`);
    }

    const resJson = await response.json();
    if (resJson.status === 'error') {
      throw new Error(resJson.message || 'Error occurred in Apps Script.');
    }

    return NextResponse.json({
      success: true,
      count: rows.length,
      message: `Successfully exported ${rows.length} rows to Google Sheets.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
