import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

type TicketRow = {
  id: string;
  ticket_no: string | null;
  subject: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  module: string | null;
  issue_type: string | null;
  created_at: string | null;
  resolved_at: string | null;
  resolution_summary: string | null;
  customers: {
    display_name: string | null;
    line_user_id: string | null;
    organizations: { name: string | null } | null;
  } | null;
  assigned_agent: { display_name: string | null } | null;
  department_data: { name: string | null } | null;
};
type AutoTableDoc = { lastAutoTable?: { finalY?: number } };

function asObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing ticket id' }, { status: 400 });
    }

    const supabaseServer = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [jsPdfModule, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const jsPDF = jsPdfModule.jsPDF;
    const autoTable = autoTableModule.default;

    const { data: ticketData, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select(
        `
        id,
        ticket_no,
        subject,
        description,
        status,
        priority,
        module,
        issue_type,
        created_at,
        resolved_at,
        resolution_summary,
        customers:customers!tickets_customer_id_fkey(
          display_name,
          line_user_id,
          organizations!organization_id(name)
        ),
        assigned_agent:profiles!assigned_agent_id(display_name:full_name),
        department_data:departments!current_department_id(name)
      `
      )
      .eq('id', id)
      .single();

    if (ticketError || !ticketData) {
      return NextResponse.json({ error: ticketError?.message || 'Ticket not found' }, { status: 404 });
    }

    const { data: messageRows } = await supabaseAdmin
      .from('messages')
      .select('created_at,sender_type,content')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })
      .limit(80);

    const ticket = ticketData as unknown as TicketRow;
    const customer = asObject(ticket.customers);
    const organization = asObject(customer?.organizations);
    const agent = asObject(ticket.assigned_agent);
    const department = asObject(ticket.department_data);

    const doc = new jsPDF('p', 'mm', 'a4');
    const generatedAt = new Date().toLocaleString('th-TH');
    const createdAt = ticket.created_at ? new Date(ticket.created_at).toLocaleString('th-TH') : '-';
    const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleString('th-TH') : '-';

    doc.setFontSize(16);
    doc.text(`Ticket Summary #${ticket.ticket_no || ticket.id}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Generated: ${generatedAt}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      theme: 'grid',
      head: [['Field', 'Value']],
      body: [
        ['Status', ticket.status || '-'],
        ['Priority', ticket.priority || '-'],
        ['Subject', ticket.subject || '-'],
        ['Description', ticket.description || '-'],
        ['Resolution', ticket.resolution_summary || '-'],
        ['Module', ticket.module || '-'],
        ['Issue Type', ticket.issue_type || '-'],
        ['Customer', customer?.display_name || '-'],
        ['Organization', organization?.name || '-'],
        ['Department', department?.name || '-'],
        ['Assigned Agent', agent?.display_name || '-'],
        ['Created At', createdAt],
        ['Resolved At', resolvedAt],
      ],
      styles: { fontSize: 9, cellPadding: 2.6 },
      headStyles: { fillColor: [54, 153, 255] },
      columnStyles: { 0: { cellWidth: 42 } },
    });

    const rows =
      (messageRows || []).map((message) => [
        message.created_at ? new Date(message.created_at).toLocaleTimeString('th-TH') : '-',
        String(message.sender_type || '-'),
        String(message.content || '-').slice(0, 180),
      ]) || [];

    autoTable(doc, {
      startY: (((doc as unknown as AutoTableDoc).lastAutoTable?.finalY) ?? 28) + 8,
      theme: 'striped',
      head: [['Time', 'Sender', 'Message']],
      body: rows.length ? rows : [['-', '-', 'No messages']],
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      headStyles: { fillColor: [17, 24, 39] },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 26 },
        2: { cellWidth: 'auto' },
      },
    });

    const pdfArrayBuffer = doc.output('arraybuffer');
    const fileName = `Service_Report_${ticket.ticket_no || id}.pdf`;

    return new NextResponse(pdfArrayBuffer as unknown as BodyInit, {
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
