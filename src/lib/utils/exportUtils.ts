import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Ticket } from '@/types';

/**
 * Universal Excel Export
 */
export const exportToExcel = (data: Record<string, unknown>[], fileName: string) => {
  if (!data || data.length === 0) {
    alert('ไม่มีข้อมูลสำหรับส่งออก (No data to export)');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
};

/**
 * Universal PDF Export with Thai Font Support (Placeholder for now)
 */
export const exportToPDF = (data: Record<string, unknown>[], fileName: string, title: string) => {
  if (!data || data.length === 0) {
    alert('ไม่มีข้อมูลสำหรับส่งออก (No data to export)');
    return;
  }
  const doc = new jsPDF() as jsPDF & { autoTable: (options: unknown) => void };
  
  // Header
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated at: ${new Date().toLocaleString('th-TH')}`, 14, 30);

  // Table
  const headers = Object.keys(data[0]);
  const body = data.map(item => Object.values(item).map(v => String(v)));

  doc.autoTable({
    head: [headers],
    body: body,
    startY: 40,
    theme: 'grid',
    headStyles: { fillColor: [0, 242, 254], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { top: 40 },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  doc.save(`${fileName}_${new Date().getTime()}.pdf`);
};

/**
 * Bulk Ticket Export (Helper)
 */
export const exportTickets = (tickets: Ticket[], format: 'xlsx' | 'pdf') => {
  const formatted = tickets.map(t => ({
    'Ticket No': t.ticket_no,
    'Subject': t.subject,
    'Customer': (t.customers as unknown as { display_name?: string | null })?.display_name || 'N/A',
    'Status': t.status,
    'Priority': t.priority,
    'Created At': new Date(t.created_at).toLocaleString('th-TH'),
    'Resolved At': t.resolved_at ? new Date(t.resolved_at).toLocaleString('th-TH') : '-'
  }));

  if (format === 'xlsx') {
    exportToExcel(formatted, 'NeoSupport_Tickets');
  } else {
    exportToPDF(formatted, 'NeoSupport_Tickets', 'Report: All Tickets');
  }
};
