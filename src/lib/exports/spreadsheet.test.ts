import { describe, expect, it } from 'vitest';
import { objectsToSpreadsheetRows } from './spreadsheet';

describe('objectsToSpreadsheetRows', () => {
  it('preserves object key order as a header row', () => {
    expect(
      objectsToSpreadsheetRows([
        { Name: 'Neo', Count: 2 },
        { Name: 'Support', Count: 3 },
      ])
    ).toEqual([
      ['Name', 'Count'],
      ['Neo', 2],
      ['Support', 3],
    ]);
  });

  it('normalizes missing values and rejects unsupported object values', () => {
    expect(objectsToSpreadsheetRows([{ Name: null, Active: undefined }])).toEqual([
      ['Name', 'Active'],
      ['', ''],
    ]);

    expect(() => objectsToSpreadsheetRows([{ Nested: { unsafe: true } }])).toThrow(
      'Unsupported spreadsheet cell value'
    );
  });
});
