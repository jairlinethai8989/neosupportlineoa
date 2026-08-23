import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getStaffAuth } from '@/lib/auth/staffAuthorization';

export const runtime = 'nodejs';
type AutoTableDoc = { lastAutoTable?: { finalY?: number } };
type AutoTablePageContext = { settings: { margin: { left: number } } };

type TicketRow = {
  ticket_no: string | null;
  subject: string | null;
  issue_type: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
};

function parseDateTimeParam(value: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeIssueType(ticket: TicketRow): string {
  const issueType = String(ticket.issue_type || '').trim();
  if (issueType) return issueType;

  const subject = String(ticket.subject || '').trim();
  if (!subject) return 'Other';

  const separatorIndex = subject.indexOf(':');
  if (separatorIndex > 0) {
    return subject.slice(0, separatorIndex).trim() || subject;
  }
  return subject;
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

    const [jsPdfModule, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const jsPDF = jsPdfModule.jsPDF;
    const autoTable = autoTableModule.default;

    const { data, error } = await supabaseAdmin
      .from('tickets')
      .select('ticket_no,subject,issue_type,status,priority,created_at')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    const tickets = (data || []) as TicketRow[];

    const statusCounts = tickets.reduce<Record<string, number>>((acc, ticket) => {
      const key = String(ticket.status || 'Unknown');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const categoryCounts = tickets.reduce<Record<string, number>>((acc, ticket) => {
      const key = normalizeIssueType(ticket);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const doc = new jsPDF('p', 'mm', 'a4');
    const generatedAt = new Date().toLocaleString('th-TH');

    doc.setFontSize(16);
    doc.text('Executive Intelligence Report', 14, 16);
    doc.setFontSize(10);
    doc.text(`Range: ${new Date(start).toLocaleDateString('th-TH')} - ${new Date(end).toLocaleDateString('th-TH')}`, 14, 22);
    doc.text(`Generated: ${generatedAt}`, 14, 27);

    const openActiveCount = (statusCounts['New'] || 0) + (statusCounts['In Progress'] || 0);
    const resolvedClosedCount = (statusCounts['Resolved'] || 0) + (statusCounts['Closed'] || 0);

    autoTable(doc, {
      startY: 32,
      theme: 'grid',
      head: [['Metric', 'Value']],
      body: [
        ['Total tickets', String(tickets.length)],
        ['Open/Active', String(openActiveCount)],
        ['Resolved/Closed', String(resolvedClosedCount)],
      ],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: { 0: { cellWidth: 60 } },
    });

    autoTable(doc, {
      startY: (((doc as unknown as AutoTableDoc).lastAutoTable?.finalY) ?? 32) + 8,
      theme: 'striped',
      head: [['Status', 'Count']],
      body: Object.entries(statusCounts).map(([status, count]) => [status, String(count)]),
      styles: { fontSize: 8.8, cellPadding: 2.2 },
      headStyles: { fillColor: [17, 24, 39] },
      columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 40 } },
    });

    autoTable(doc, {
      startY: (((doc as unknown as AutoTableDoc).lastAutoTable?.finalY) ?? 32) + 6,
      theme: 'striped',
      head: [['Top Issue Category', 'Count']],
      body: topCategories.length ? topCategories.map(([name, count]) => [name, String(count)]) : [['No data', '0']],
      styles: { fontSize: 8.8, cellPadding: 2.2 },
      headStyles: { fillColor: [22, 160, 133] },
      columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 40 } },
    });

    autoTable(doc, {
      startY: (((doc as unknown as AutoTableDoc).lastAutoTable?.finalY) ?? 32) + 8,
      theme: 'grid',
      head: [['Ticket', 'Subject', 'Status', 'Priority', 'Created']],
      body: tickets.slice(0, 120).map((ticket) => [
        ticket.ticket_no || '-',
        ticket.subject || '-',
        ticket.status || '-',
        ticket.priority || '-',
        ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('th-TH') : '-',
      ]),
      styles: { fontSize: 8.1, cellPadding: 2.1 },
      headStyles: { fillColor: [54, 153, 255] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 70 },
        2: { cellWidth: 28 },
        3: { cellWidth: 24 },
        4: { cellWidth: 28 },
      },
      didDrawPage: (dataArg: unknown) => {
        const context = dataArg as AutoTablePageContext;
        const pageNumber = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(`Page ${pageNumber}`, context.settings.margin.left, 290);
      },
    });

    const fileName = `Analytics_Report_${new Date(start).toISOString().slice(0, 10)}_${new Date(end)
      .toISOString()
      .slice(0, 10)}.pdf`;
    const pdfBuffer = doc.output('arraybuffer');

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
