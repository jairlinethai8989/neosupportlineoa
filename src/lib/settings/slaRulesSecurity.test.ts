import { describe, expect, it } from 'vitest';
import { parseSlaRulesInput } from './slaRulesSecurity';

describe('parseSlaRulesInput', () => {
  it('normalizes valid SLA rules', () => {
    expect(
      parseSlaRulesInput([
        {
          id: '11111111-1111-4111-8111-111111111111',
          priority: 'Critical',
          response_time_minutes: '15',
          resolution_time_minutes: 120,
          ignored: 'field',
        },
      ])
    ).toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        priority: 'Critical',
        response_time_minutes: 15,
        resolution_time_minutes: 120,
      },
    ]);
  });

  it('rejects malformed, duplicate, or out-of-range SLA rules', () => {
    expect(() => parseSlaRulesInput([{ priority: 'Urgent', response_time_minutes: 1, resolution_time_minutes: 1 }]))
      .toThrow('Invalid SLA priority');
    expect(() =>
      parseSlaRulesInput([
        { priority: 'High', response_time_minutes: 1, resolution_time_minutes: 1 },
        { priority: 'High', response_time_minutes: 2, resolution_time_minutes: 2 },
      ])
    ).toThrow('Duplicate SLA priority');
    expect(() => parseSlaRulesInput([{ priority: 'Low', response_time_minutes: -1, resolution_time_minutes: 1 }]))
      .toThrow('Invalid response time');
  });
});
