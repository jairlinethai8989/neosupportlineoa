const LARK_IDENTIFIER = /^[A-Za-z0-9_-]{4,128}$/;
const DEFAULT_SHEET_ID = '0bdfef';

export function parseLarkSheetTarget(spreadsheetToken: unknown, sheetId: unknown) {
  if (typeof spreadsheetToken !== 'string' || !LARK_IDENTIFIER.test(spreadsheetToken)) {
    throw new TypeError('Invalid Lark spreadsheet token');
  }

  const normalizedSheetId = sheetId === undefined || sheetId === null || sheetId === ''
    ? DEFAULT_SHEET_ID
    : sheetId;
  if (typeof normalizedSheetId !== 'string' || !LARK_IDENTIFIER.test(normalizedSheetId)) {
    throw new TypeError('Invalid Lark sheet id');
  }

  return { spreadsheetToken, sheetId: normalizedSheetId };
}
