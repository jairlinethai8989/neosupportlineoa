import { describe, expect, it } from 'vitest';
import { parseDashboardExportInput, toAnalyticsDashboardDto } from './dashboardSecurity';

describe('parseDashboardExportInput', () => {
  it('normalizes a valid bounded request', () => {
    expect(parseDashboardExportInput({
      from: '2026-08-01T00:00:00+07:00',
      to: '2026-08-23T23:59:59+07:00',
      organizationId: 'f4f20a4d-46ce-4e96-88a8-8050740dca5d',
      module: ' Orders ',
      issueType: '',
    })).toEqual({
      from: '2026-07-31T17:00:00.000Z',
      to: '2026-08-23T16:59:59.000Z',
      organizationId: 'f4f20a4d-46ce-4e96-88a8-8050740dca5d',
      module: 'Orders',
      issueType: null,
    });
  });

  it('rejects unknown fields, invalid UUIDs, and oversized ranges', () => {
    const base = { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' };
    expect(() => parseDashboardExportInput({ ...base, extra: true })).toThrow();
    expect(() => parseDashboardExportInput({ ...base, organizationId: 'not-a-uuid' })).toThrow();
    expect(() => parseDashboardExportInput({ from: '2024-01-01', to: '2026-01-02' })).toThrow();
  });
});

describe('toAnalyticsDashboardDto', () => {
  it('returns only bounded aggregate fields', () => {
    const result = toAnalyticsDashboardDto({
      total_records: 4,
      status_data: [{ name: 'New', value: 4, secret: 'drop' }],
      priority_data: [{ name: 'High', value: '2' }],
      secret: 'drop',
    });
    expect(result.status_data).toEqual([{ name: 'New', value: 4 }]);
    expect(result.priority_data).toEqual([{ name: 'High', value: 2 }]);
    expect(result).not.toHaveProperty('secret');
  });
});
