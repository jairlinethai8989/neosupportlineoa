import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * Universal Excel Export
 */
export const exportToExcel = (data: any[], fileName: string) => {
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
export const exportToPDF = (data: any[], fileName: string, title: string) => {
  console.log('Exporting PDF...', { data, fileName, title });
  try {
    if (!data || data.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก (No data to export)');
      return;
    }
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated at: ${new Date().toLocaleString('th-TH')}`, 14, 30);
    doc.text(`Note: PDF might not display Thai correctly. Please use Excel for full Thai support.`, 14, 36);

    // Table
    const headers = Object.keys(data[0]);
    const body = data.map(item => Object.values(item).map(v => String(v)));

    doc.autoTable({
      head: [headers],
      body: body,
      startY: 42,
      theme: 'grid',
      headStyles: { fillColor: [0, 242, 254], textColor: [0, 0, 0], fontStyle: 'bold' },
      margin: { top: 40 },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`${fileName}_${new Date().getTime()}.pdf`);
    console.log('PDF Export successful');
  } catch (err) {
    console.error('PDF Export Error:', err);
    alert('PDF Export failed. Please try Excel instead.');
  }
};

/**
 * Bulk Ticket Export (Helper)
 */
export const exportTickets = (tickets: any[], format: 'xlsx' | 'pdf') => {
  const formatted = tickets.map(t => ({
    'Ticket No': t.ticket_no,
    'Subject': t.subject,
    'Customer': t.customers?.display_name || 'N/A',
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
