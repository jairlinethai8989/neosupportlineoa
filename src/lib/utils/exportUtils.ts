import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToPDF = (data: any[], fileName: string, title: string) => {
  const doc = new jsPDF() as any;
  
  // Header
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated at: ${new Date().toLocaleString()}`, 14, 30);

  // Table
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    const body = data.map(item => Object.values(item));

    doc.autoTable({
      head: [headers],
      body: body,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [115, 103, 240] },
      margin: { top: 40 }
    });
  }

  doc.save(`${fileName}.pdf`);
};
