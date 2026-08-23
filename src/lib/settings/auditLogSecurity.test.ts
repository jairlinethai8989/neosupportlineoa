import { describe, expect, it } from 'vitest';
import { parseAuditLogFilters } from './auditLogSecurity';

describe('parseAuditLogFilters', () => {
  it('normalizes supported filters and caps the result limit', () => {
    expect(parseAuditLogFilters({
      agentId: '82000000-0000-0000-0000-000000000001',
      actionType: '  STAFF_CREATE  ',
      limit: 999,
    })).toEqual({
      agentId: '82000000-0000-0000-0000-000000000001',
      actionType: 'STAFF_CREATE',
      limit: 200,
    });
  });

  it('uses safe defaults for empty filters', () => {
    expect(parseAuditLogFilters({ agentId: 'all', actionType: 'all' })).toEqual({
      limit: 50,
    });
  });

  it.each([
    { agentId: 'not-a-uuid' },
    { actionType: 'x'.repeat(81) },
    { actionType: 'DROP TABLE system_logs' },
    { limit: 0 },
  ])('rejects invalid filters: %o', (value) => {
    expect(() => parseAuditLogFilters(value)).toThrow('Invalid audit log filters');
  });
});
