import { describe, expect, it } from 'vitest';
import { formatDateTime } from './exportUtils';

describe('exportUtils', () => {
  it('returns fallback for empty date', () => {
    expect(formatDateTime(undefined)).toBe('-');
    expect(formatDateTime(null)).toBe('-');
  });

  it('formats valid iso date', () => {
    const result = formatDateTime('2026-04-30T12:34:56.000Z');
    expect(result).not.toBe('-');
  });
});
