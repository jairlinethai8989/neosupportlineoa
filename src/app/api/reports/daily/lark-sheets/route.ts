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

// Convert DB rows to Lark Sheet array format
function getExportRowArray(row: RawTicket): string[] {
  const hospital = toObject(row.hospitals);
  const customer = toObject(row.customers);
  const customerHospital = toObject(customer?.hospitals || null);
  const assignee = toObject(row.assigned_agent);

  const createdAt = new Date(row.created_at);
  const resolvedAt = row.resolved_at ? new Date(row.resolved_at) : null;

  return [
    row.status || '',
    createdAt.toLocaleDateString('th-TH'),
    hospital?.name || customerHospital?.name || '',
    customer?.display_name || '',
    getTicketSubjectOnly(row.subject, row.description),
    row.description || '',
    row.resolution_summary || '',
    assignee?.display_name || '',
    row.source || '',
    row.module || '',
    row.issue_type || row.priority || '',
    createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    resolvedAt ? resolvedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-',
    getDurationStr(row.created_at, row.resolved_at),
  ];
}

// 1. Authenticate with Lark to get tenant_access_token
async function getLarkTenantToken(): Promise<string> {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('Missing LARK_APP_ID or LARK_APP_SECRET in server environment variables.');
  }

  const response = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Lark tenant token: HTTP status ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`Lark Auth Error: ${data.msg} (Code: ${data.code})`);
  }

  return data.tenant_access_token;
}

// 2. Append rows to Lark Sheet
async function appendRowsToLarkSheet(
  token: string,
  spreadsheetToken: string,
  sheetId: string,
  rows: string[][]
): Promise<unknown> {
  const endpoint = `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_append`;
  
  const payload = {
    valueRange: {
      range: `${sheetId}!A1:N1`,
      values: rows,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Lark Sheets API responded with status: ${response.status}`);
  }

  const resJson = await response.json();
  if (resJson.code !== 0) {
    throw new Error(`Lark Sheets API Error: ${resJson.msg} (Code: ${resJson.code})`);
  }

  return resJson.data;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const start = parseDateParam(body.start);
    const end = parseDateParam(body.end);
    const spreadsheetToken = body.spreadsheetToken;
    const sheetId = body.sheetId || '0bdfef'; // Defaults to first sheet grid ID if not provided

    // Validations
    if (!start || !end) {
      return NextResponse.json({ error: 'Invalid date format. Expected yyyy-MM-dd.' }, { status: 400 });
    }
    if (!spreadsheetToken) {
      return NextResponse.json({ error: 'Missing spreadsheetToken parameter.' }, { status: 400 });
    }

    // Auth verification
    const supabaseServer = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query ticket data from Supabase
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
      .order('created_at', { ascending: true }); // Ascending order to append chronologically

    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No tickets found for the selected date range.' });
    }

    // Format rows as 2D array
    const formattedRows = (data as RawTicket[]).map(getExportRowArray);

    // Get Lark Tenant Access Token
    const larkToken = await getLarkTenantToken();

    // Export to Lark Sheets
    const result = await appendRowsToLarkSheet(
      larkToken,
      spreadsheetToken,
      sheetId,
      formattedRows
    );

    return NextResponse.json({
      success: true,
      count: formattedRows.length,
      message: `Successfully exported ${formattedRows.length} rows to Lark Sheets.`,
      details: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Lark Sheets API Route Error]:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
