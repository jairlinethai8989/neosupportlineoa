import { describe, expect, it } from 'vitest';
import {
  parseGeneratedPresentationInsights,
  parsePresentationAiRequest,
} from './presentationAiSecurity';

const validRequest = {
  ticketData: {
    dateRange: { start: '2026-08-01', end: '2026-08-07' },
    summary: {
      totalTickets: 2,
      resolvedTickets: 1,
      resolvedRate: 50,
      topHospital: { name: 'Example Organization', count: 2 },
      topCategory: { name: 'Network', count: 2 },
    },
    categories: [{ name: 'Network', count: 2 }],
    topOrganizations: [
      {
        name: 'Example Organization',
        totalTickets: 2,
        resolvedTickets: 1,
        tickets: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            subject: 'Intermittent connection',
            status: 'Resolved',
            issue_type: 'Network',
            created_at: '2026-08-02T03:04:05.000Z',
          },
        ],
      },
    ],
  },
  customPrompt: '  Focus on recurring incidents.  ',
};

describe('parsePresentationAiRequest', () => {
  it('accepts and normalizes the presentation request produced by the dashboard', () => {
    expect(parsePresentationAiRequest(validRequest)).toEqual({
      ...validRequest,
      customPrompt: 'Focus on recurring incidents.',
    });
  });

  it.each([
    ['client-provided API key', { ...validRequest, userApiKey: 'secret' }],
    ['unknown field', { ...validRequest, debug: true }],
    ['empty custom prompt', { ...validRequest, customPrompt: '   ' }],
    ['oversized custom prompt', { ...validRequest, customPrompt: 'x'.repeat(2001) }],
    ['unsafe custom prompt', { ...validRequest, customPrompt: 'Focus\u0000now' }],
  ])('rejects an untrusted top-level request: %s', (_label, request) => {
    expect(() => parsePresentationAiRequest(request)).toThrow(TypeError);
  });

  it.each([
    ['missing ticket data', { ...validRequest, ticketData: null }],
    ['unknown summary field', {
      ...validRequest,
      ticketData: {
        ...validRequest.ticketData,
        summary: { ...validRequest.ticketData.summary, internal: true },
      },
    }],
    ['invalid calendar date', {
      ...validRequest,
      ticketData: {
        ...validRequest.ticketData,
        dateRange: { start: '2026-02-30', end: '2026-03-01' },
      },
    }],
    ['oversized date range', {
      ...validRequest,
      ticketData: {
        ...validRequest.ticketData,
        dateRange: { start: '2025-01-01', end: '2026-08-01' },
      },
    }],
    ['invalid resolution rate', {
      ...validRequest,
      ticketData: {
        ...validRequest.ticketData,
        summary: { ...validRequest.ticketData.summary, resolvedRate: 101 },
      },
    }],
    ['too many categories', {
      ...validRequest,
      ticketData: {
        ...validRequest.ticketData,
        categories: Array.from({ length: 101 }, () => ({ name: 'Category', count: 1 })),
      },
    }],
    ['too many organizations', {
      ...validRequest,
      ticketData: {
        ...validRequest.ticketData,
        topOrganizations: Array.from(
          { length: 11 },
          () => validRequest.ticketData.topOrganizations[0]
        ),
      },
    }],
    ['too many organization tickets', {
      ...validRequest,
      ticketData: {
        ...validRequest.ticketData,
        topOrganizations: [{
          ...validRequest.ticketData.topOrganizations[0],
          tickets: Array.from(
            { length: 11 },
            () => validRequest.ticketData.topOrganizations[0].tickets[0]
          ),
        }],
      },
    }],
    ['invalid ticket id', {
      ...validRequest,
      ticketData: {
        ...validRequest.ticketData,
        topOrganizations: [{
          ...validRequest.ticketData.topOrganizations[0],
          tickets: [{ ...validRequest.ticketData.topOrganizations[0].tickets[0], id: 'not-a-uuid' }],
        }],
      },
    }],
    ['invalid ticket timestamp', {
      ...validRequest,
      ticketData: {
        ...validRequest.ticketData,
        topOrganizations: [{
          ...validRequest.ticketData.topOrganizations[0],
          tickets: [{ ...validRequest.ticketData.topOrganizations[0].tickets[0], created_at: 'yesterday' }],
        }],
      },
    }],
  ])('rejects malformed presentation data: %s', (_label, request) => {
    expect(() => parsePresentationAiRequest(request)).toThrow(TypeError);
  });
});

describe('parseGeneratedPresentationInsights', () => {
  const validInsights = {
    executiveSummary: 'Operations remained stable during the reporting period.',
    keyChallenges: [{ title: 'Recurring incident', description: 'Two related cases were found.' }],
    actionItems: [{ action: 'Review the root cause', owner: 'Support team', targetDate: '2026-08-20' }],
    hospitalInsights: { 'Example Organization': 'Prioritize the recurring network incident.' },
  };

  it('accepts the exact presentation insights contract', () => {
    expect(parseGeneratedPresentationInsights(validInsights)).toEqual(validInsights);
  });

  it.each([
    ['unknown field', { ...validInsights, model: 'secret' }],
    ['oversized summary', { ...validInsights, executiveSummary: 'x'.repeat(5001) }],
    ['too many challenges', {
      ...validInsights,
      keyChallenges: Array.from({ length: 6 }, () => validInsights.keyChallenges[0]),
    }],
    ['unknown challenge field', {
      ...validInsights,
      keyChallenges: [{ ...validInsights.keyChallenges[0], severity: 'high' }],
    }],
    ['invalid target date', {
      ...validInsights,
      actionItems: [{ ...validInsights.actionItems[0], targetDate: 'soon' }],
    }],
    ['too many hospital insights', {
      ...validInsights,
      hospitalInsights: Object.fromEntries(
        Array.from({ length: 11 }, (_, index) => [`Organization ${index}`, 'Insight'])
      ),
    }],
    ['unsafe hospital insight', {
      ...validInsights,
      hospitalInsights: { 'Example Organization': 'Insight\u0000payload' },
    }],
  ])('rejects untrusted presentation model output: %s', (_label, insights) => {
    expect(() => parseGeneratedPresentationInsights(insights)).toThrow(TypeError);
  });
});
