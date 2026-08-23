import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getStaffAuth } from '@/lib/auth/staffAuthorization';
import { objectsToSpreadsheetRows } from '@/lib/exports/spreadsheet';
import { writeSpreadsheetBuffer } from '@/lib/exports/spreadsheet.server';

export const runtime = 'nodejs';

function parseDateTimeParam(value: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export async function GET(req: Request) {
  try {
    const auth = await getStaffAuth({ permission: 'reports', level: 'view' });
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const start = parseDateTimeParam(searchParams.get('start'));
    const end = parseDateTimeParam(searchParams.get('end'));

    if (!start || !end) {
      return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('tickets')
      .select('ticket_no,subject,status,priority,created_at')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const rows = (data || []).map((ticket) => ({
      'No.': ticket.ticket_no || '',
      Subject: ticket.subject || '',
      Status: ticket.status || '',
      Priority: ticket.priority || '',
      Created: ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('th-TH') : '',
    }));

    const buffer = await writeSpreadsheetBuffer(
      objectsToSpreadsheetRows(rows),
      'Analytics Report'
    );

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Analytics_Report.xlsx"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
