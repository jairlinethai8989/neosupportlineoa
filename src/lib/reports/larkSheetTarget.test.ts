import { describe, expect, it } from 'vitest';
import { parseLarkSheetTarget } from './larkSheetTarget';

describe('parseLarkSheetTarget', () => {
  it('accepts bounded Lark identifiers and rejects path/range injection', () => {
    expect(parseLarkSheetTarget('shtcnAbC_123-xyz', '0bdfef')).toEqual({
      spreadsheetToken: 'shtcnAbC_123-xyz',
      sheetId: '0bdfef',
    });
    expect(parseLarkSheetTarget('shtcnAbC_123-xyz', undefined)).toEqual({
      spreadsheetToken: 'shtcnAbC_123-xyz',
      sheetId: '0bdfef',
    });

    for (const token of ['../../auth', 'token?x=1', 'token/values', ' token']) {
      expect(() => parseLarkSheetTarget(token, '0bdfef')).toThrow('Invalid Lark spreadsheet token');
    }
    for (const sheetId of ['Sheet1!A1', '../admin', 'sheet?id=1']) {
      expect(() => parseLarkSheetTarget('shtcnAbC_123-xyz', sheetId)).toThrow('Invalid Lark sheet id');
    }
  });
});
