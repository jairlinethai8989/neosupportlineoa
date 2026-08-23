import { describe, expect, it } from 'vitest';
import {
  buildBoundedTicketChatLog,
  parseGeneratedTicketAiSummary,
  parseTicketAiSummaryId,
  sanitizeTicketAiContextText,
} from './aiSummarySecurity';

describe('parseTicketAiSummaryId', () => {
  it('accepts only a UUID ticket identifier', () => {
    expect(parseTicketAiSummaryId('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(() => parseTicketAiSummaryId('not-a-uuid')).toThrow(TypeError);
    expect(() => parseTicketAiSummaryId('')).toThrow(TypeError);
  });
});

describe('parseGeneratedTicketAiSummary', () => {
  const validSummary = {
    rootCause: 'The user role was configured incorrectly.',
    resolution: 'The support team corrected the role and cleared the cache.',
    preventiveRecommendations: ['Add an automated permission regression test.'],
  };

  it('accepts the exact ticket post-mortem contract', () => {
    expect(parseGeneratedTicketAiSummary(validSummary)).toEqual(validSummary);
  });

  it.each([
    ['unknown field', { ...validSummary, rawChat: 'secret' }],
    ['empty root cause', { ...validSummary, rootCause: '   ' }],
    ['oversized resolution', { ...validSummary, resolution: 'x'.repeat(5001) }],
    ['no recommendations', { ...validSummary, preventiveRecommendations: [] }],
    ['too many recommendations', {
      ...validSummary,
      preventiveRecommendations: Array.from({ length: 6 }, () => 'Recommendation'),
    }],
    ['unsafe recommendation', {
      ...validSummary,
      preventiveRecommendations: ['Recommendation\u0000payload'],
    }],
  ])('rejects untrusted ticket model output: %s', (_label, summary) => {
    expect(() => parseGeneratedTicketAiSummary(summary)).toThrow(TypeError);
  });
});

describe('buildBoundedTicketChatLog', () => {
  it('keeps bounded recent chat context and removes unsafe controls', () => {
    const messages = Array.from({ length: 201 }, (_, index) => ({
      sender_type: index % 2 === 0 ? 'staff' : 'customer',
      content: index === 200 ? `latest\u0000${'x'.repeat(5000)}` : `message-${index}`,
    }));

    const chatLog = buildBoundedTicketChatLog(messages);

    expect(chatLog).not.toContain('message-0');
    expect(chatLog).toContain('latest');
    expect(chatLog).not.toContain('\u0000');
    expect(chatLog.length).toBeLessThanOrEqual(40_000);
    expect(chatLog.split('\n')).toHaveLength(200);
  });
});

describe('sanitizeTicketAiContextText', () => {
  it('bounds ticket fields before they enter the external AI prompt', () => {
    const sanitized = sanitizeTicketAiContextText(`subject\u0000${'x'.repeat(5000)}`, 1000);
    expect(sanitized).not.toContain('\u0000');
    expect(sanitized.length).toBe(1000);
    expect(sanitizeTicketAiContextText(null, 1000)).toBe('-');
  });
});
