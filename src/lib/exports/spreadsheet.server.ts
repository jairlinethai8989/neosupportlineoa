import type { SpreadsheetRows } from './spreadsheet';

export async function writeSpreadsheetBuffer(
  rows: SpreadsheetRows,
  sheetName: string
): Promise<Buffer> {
  const { default: writeExcelFile } = await import('write-excel-file/node');
  return writeExcelFile(rows, { sheet: sheetName }).toBuffer();
}
