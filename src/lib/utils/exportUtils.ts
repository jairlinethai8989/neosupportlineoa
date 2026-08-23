import { downloadObjectsSpreadsheet } from '@/lib/exports/spreadsheet.browser';

type PdfModules = {
  jsPDF: (typeof import('jspdf'))['jsPDF'];
  autoTable: typeof import('jspdf-autotable')['default'];
};

let pdfModulesPromise: Promise<PdfModules> | null = null;

async function loadPdfModules(): Promise<PdfModules> {
  if (!pdfModulesPromise) {
    pdfModulesPromise = Promise.all([import('jspdf'), import('jspdf-autotable')]).then(
      ([jsPdfModule, autoTableModule]) => ({
        jsPDF: jsPdfModule.jsPDF,
        autoTable: autoTableModule.default,
      })
    );
  }

  return pdfModulesPromise;
}

function escapeHtml(input: unknown): string {
  const value = String(input ?? '-');
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type ExportCellValue = string | number | boolean | null | undefined;
type ExportRow = Record<string, ExportCellValue>;
export const formatDateTime = (value?: string | null): string =>
  value ? new Date(value).toLocaleString('th-TH') : '-';

interface TicketLike {
  ticket_no?: string | null;
  subject?: string | null;
  customers?: { display_name?: string | null } | null;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
}

/**
 * Universal Excel Export
 */
export const exportToExcel = async <T extends ExportRow>(data: T[], fileName: string) => {
  if (!data || data.length === 0) {
    alert('ไม่มีข้อมูลสำหรับส่งออก (No data to export)');
    return;
  }
  try {
    await downloadObjectsSpreadsheet(
      data,
      `${fileName}_${new Date().getTime()}.xlsx`,
      'Report'
    );
  } catch (err) {
    console.error('Excel Export Error:', err);
    alert('Excel Export failed. Please check browser permissions.');
  }
};

/**
 * Universal PDF Export with Thai Font Support (Note: Thai chars need embedded font for full rendering)
 */
export const exportToPDF = async <T extends ExportRow>(data: T[], fileName: string, title: string) => {

  try {
    if (!data || data.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก (No data to export)');
      return;
    }
    const { jsPDF, autoTable } = await loadPdfModules();
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
    const body = data.map((item) => {
      const row = item as Record<string, ExportCellValue>;
      return headers.map((header) => String(row[header] ?? '-'));
    });

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

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Error';
    console.error('PDF Export Error:', err);
    alert('PDF Export failed: ' + message);
  }
};

/**
 * Professional Image-based PDF Export (Fixes Thai font issues)
 */
export const exportDashboardAsPDF = async (
  title: string, 
  pages: string[], // Array of base64 images (one per page)
  fileName: string
) => {
  try {
    const { jsPDF } = await loadPdfModules();
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) doc.addPage();
      
      const imgData = pages[i];
      doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    }

    doc.save(`${fileName}_${new Date().getTime()}.pdf`);
  } catch (err) {
    console.error('PDF Export Error:', err);
    alert('PDF Export failed. Please try again.');
  }
};

export const printDataTable = <T extends ExportRow>(title: string, data: T[], subtitle?: string) => {
  if (!data || data.length === 0) {
    alert('ไม่พบข้อมูลสำหรับพิมพ์');
    return;
  }

  const headers = Object.keys(data[0] || {});
  const rows = data
    .map((row) =>
      `<tr>${headers.map((header) => `<td>${escapeHtml((row as Record<string, ExportCellValue>)[header])}</td>`).join('')}</tr>`
    )
    .join('');

  const html = `
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          .sub { margin: 0 0 6px; color: #666; font-size: 12px; }
          .meta { margin: 0 0 18px; color: #777; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; text-align: left; }
          th { background: #f3f5f9; font-weight: 700; }
          tr:nth-child(even) { background: #fafafa; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ''}
        <p class="meta">Printed at: ${escapeHtml(new Date().toLocaleString('th-TH'))}</p>
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=1280,height=900');
  if (!printWindow) {
    alert('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต pop-up');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
};

/**
 * Bulk Ticket Export (Helper)
 */
export const exportTickets = (tickets: TicketLike[], format: 'xlsx' | 'pdf') => {
  const formatted = tickets.map(t => ({
    'Ticket No': t.ticket_no,
    'Subject': t.subject,
    'Customer': t.customers?.display_name || 'N/A',
    'Status': t.status,
    'Priority': t.priority,
    'Created At': formatDateTime(t.created_at),
    'Resolved At': formatDateTime(t.resolved_at)
  }));

  if (format === 'xlsx') {
    exportToExcel(formatted, 'NeoSupport_Tickets');
  } else {
    void exportToPDF(formatted, 'NeoSupport_Tickets', 'Report: All Tickets');
  }
};

export const printTickets = (tickets: TicketLike[], title = 'Report: All Tickets') => {
  const formatted = tickets.map((t) => ({
    'Ticket No': t.ticket_no,
    Subject: t.subject,
    Customer: t.customers?.display_name || 'N/A',
    Status: t.status,
    Priority: t.priority,
    'Created At': formatDateTime(t.created_at),
    'Resolved At': formatDateTime(t.resolved_at),
  }));
  printDataTable(title, formatted, 'NEO SUPPORT');
};
