export type SpreadsheetCellValue = string | number | boolean | Date | null;
export type SpreadsheetRows = SpreadsheetCellValue[][];

function normalizeSpreadsheetCell(value: unknown): SpreadsheetCellValue {
  if (value === null || value === undefined) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  ) {
    return value;
  }

  throw new TypeError('Unsupported spreadsheet cell value');
}

export function objectsToSpreadsheetRows<T extends Record<string, unknown>>(objects: T[]): SpreadsheetRows {
  if (objects.length === 0) return [];

  const headers = Object.keys(objects[0]);
  return [
    headers,
    ...objects.map((object) => headers.map((header) => normalizeSpreadsheetCell(object[header]))),
  ];
}
