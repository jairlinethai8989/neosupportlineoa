import { describe, expect, it } from 'vitest';
import {
  parseAnalyticsDateRange,
  parseStaffAnalyticsRequest,
} from './analyticsReadSecurity';

const AGENT_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('analytics read input validation', () => {
  it('accepts a bounded date range', () => {
    expect(parseAnalyticsDateRange({ startDate: '2026-07-01', endDate: '2026-07-31' })).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });
  });

  it('rejects invalid, reversed, excessive, and extra-field ranges', () => {
    expect(() => parseAnalyticsDateRange({ startDate: 'bad', endDate: '2026-07-31' })).toThrow();
    expect(() => parseAnalyticsDateRange({ startDate: '2026-08-01', endDate: '2026-07-31' })).toThrow();
    expect(() => parseAnalyticsDateRange({ startDate: '2024-01-01', endDate: '2026-01-01' })).toThrow();
    expect(() => parseAnalyticsDateRange({ startDate: '2026-07-01', endDate: '2026-07-31', role: 'Administrator' })).toThrow();
  });

  it('requires a canonical agent id and exact fields', () => {
    expect(parseStaffAnalyticsRequest({ agentId: AGENT_ID, startDate: '2026-07-01', endDate: '2026-07-31' })).toEqual({
      agentId: AGENT_ID,
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });
    expect(() => parseStaffAnalyticsRequest({ agentId: 'agent-1', startDate: '2026-07-01', endDate: '2026-07-31' })).toThrow();
  });
});
