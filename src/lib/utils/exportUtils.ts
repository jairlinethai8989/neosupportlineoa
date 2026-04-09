import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Universal Excel Export
 */
export const exportToExcel = (data: any[], fileName: string) => {
  if (!data || data.length === 0) {
    alert('ไม่มีข้อมูลสำหรับส่งออก (No data to export)');
    return;
  }
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
  } catch (err) {
    console.error('Excel Export Error:', err);
    alert('Excel Export failed. Please check browser permissions.');
  }
};

/**
 * Universal PDF Export with Thai Font Support (Note: Thai chars need embedded font for full rendering)
 */
export const exportToPDF = (data: any[], fileName: string, title: string) => {
  console.log('Exporting PDF...', { data, fileName, title });
  try {
    if (!data || data.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก (No data to export)');
      return;
    }
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header Section
    doc.setFontSize(22);
    doc.setTextColor(11, 22, 33);
    doc.text(title, 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Generated at: ${new Date().toLocaleString('th-TH')}`, 14, 32);
    doc.text(`* PDF Format may have limited support for non-Latin characters. For full Thai support, please export as Excel.`, 14, 38);

    // Prepare Table Data
    const headers = Object.keys(data[0]);
    const body = data.map(item => Object.values(item).map(v => String(v || '-')));

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: 45,
      theme: 'grid',
      headStyles: { 
        fillColor: [54, 153, 255], 
        textColor: [255, 255, 255], 
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 9, 
        cellPadding: 4,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 'auto' }
      },
      margin: { top: 45 },
      alternateRowStyles: { fillColor: [250, 251, 254] },
      didDrawPage: (dataArg) => {
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${dataArg.pageNumber}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
      }
    });

    doc.save(`${fileName}_${new Date().getTime()}.pdf`);
    console.log('PDF Export successful');
  } catch (err: any) {
    console.error('PDF Export Error:', err);
    alert('PDF Export failed: ' + (err.message || 'Unknown Error'));
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
