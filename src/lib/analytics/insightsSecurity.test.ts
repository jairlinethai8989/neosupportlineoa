import { describe, expect, it } from 'vitest';
import { parseAnalyticsInsightsQuery, parseGeneratedInsightsReport } from './insightsSecurity';

describe('parseAnalyticsInsightsQuery', () => {
  it('accepts the analytics UI query and normalizes its values', () => {
    const query = new URLSearchParams({
      preset: '30days',
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      ai: 'true',
      customPrompt: '  focus on recurring incidents  ',
    });

    expect(parseAnalyticsInsightsQuery(query)).toEqual({
      preset: '30days',
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      startDate: null,
      endDate: null,
      organizationsOnly: false,
      ai: true,
      customPrompt: 'focus on recurring incidents',
    });
  });

  it.each([
    ['unknown parameter', 'preset=all&debug=true'],
    ['invalid preset', 'preset=365days'],
    ['invalid organization', 'organizationId=not-a-uuid'],
    ['ambiguous boolean', 'ai=1'],
    ['incomplete range', 'startDate=2026-01-01'],
    ['invalid calendar date', 'startDate=2026-02-30&endDate=2026-03-01'],
    ['reversed range', 'startDate=2026-03-02&endDate=2026-03-01'],
    ['oversized range', 'startDate=2025-01-01&endDate=2026-02-01'],
    ['oversized prompt', `ai=true&customPrompt=${'x'.repeat(2001)}`],
    ['duplicate parameter', 'preset=all&preset=7days'],
  ])('rejects an untrusted query: %s', (_label, rawQuery) => {
    expect(() => parseAnalyticsInsightsQuery(new URLSearchParams(rawQuery))).toThrow(TypeError);
  });
});

describe('parseGeneratedInsightsReport', () => {
  it('accepts the expected report contract', () => {
    expect(parseGeneratedInsightsReport({
      executiveSummary: 'Summary based on the supplied statistics.',
      keyChallenges: [{ title: 'Recurring issue', description: 'The same issue occurred repeatedly.' }],
      actionItems: [{ action: 'Review the root cause', owner: 'Support team', targetDate: '2026-08-20' }],
    })).toEqual({
      executiveSummary: 'Summary based on the supplied statistics.',
      keyChallenges: [{ title: 'Recurring issue', description: 'The same issue occurred repeatedly.' }],
      actionItems: [{ action: 'Review the root cause', owner: 'Support team', targetDate: '2026-08-20' }],
    });
  });

  const validReport = {
    executiveSummary: 'Summary',
    keyChallenges: [{ title: 'Challenge', description: 'Description' }],
    actionItems: [{ action: 'Action', owner: 'Owner', targetDate: '2026-08-20' }],
  };

  it.each([
    ['unexpected field', { ...validReport, debug: true }],
    ['oversized summary', { ...validReport, executiveSummary: 'x'.repeat(5001) }],
    ['too many challenges', { ...validReport, keyChallenges: Array.from({ length: 6 }, () => validReport.keyChallenges[0]) }],
    ['invalid challenge shape', { ...validReport, keyChallenges: [{ title: 'Challenge' }] }],
    ['too many actions', { ...validReport, actionItems: Array.from({ length: 6 }, () => validReport.actionItems[0]) }],
    ['invalid target date', { ...validReport, actionItems: [{ action: 'Action', owner: 'Owner', targetDate: 'soon' }] }],
    ['unexpected nested field', { ...validReport, actionItems: [{ ...validReport.actionItems[0], url: 'https://evil.example' }] }],
  ])('rejects untrusted model output: %s', (_label, report) => {
    expect(() => parseGeneratedInsightsReport(report)).toThrow(TypeError);
  });
});
