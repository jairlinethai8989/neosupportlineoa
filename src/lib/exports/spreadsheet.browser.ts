import { objectsToSpreadsheetRows, type SpreadsheetRows } from './spreadsheet';

export async function downloadSpreadsheet(
  rows: SpreadsheetRows,
  fileName: string,
  sheetName: string
): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  await writeExcelFile(rows, { sheet: sheetName }).toFile(fileName);
}

export async function downloadObjectsSpreadsheet<T extends Record<string, unknown>>(
  objects: T[],
  fileName: string,
  sheetName: string
): Promise<void> {
  await downloadSpreadsheet(objectsToSpreadsheetRows(objects), fileName, sheetName);
}
