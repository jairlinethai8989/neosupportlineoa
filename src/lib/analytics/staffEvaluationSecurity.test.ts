import { describe, expect, it } from 'vitest';
import {
  parseGeneratedStaffEvaluation,
  parseStaffEvaluationQuery,
  parseStaffEvaluationRequest,
} from './staffEvaluationSecurity';

const validRequest = {
  agentId: '550e8400-e29b-41d4-a716-446655440000',
  agentName: 'Support Agent',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  kpiStats: {
    resolvedCount: 18,
    totalClaimed: 20,
    avgResolutionTime: 3.5,
    slaComplianceRate: 95,
    reworkRate: 10,
    reworkCount: 2,
    avgCsat: 4.75,
  },
};

describe('parseStaffEvaluationRequest', () => {
  it('accepts and normalizes the dashboard request contract', () => {
    expect(parseStaffEvaluationRequest({ ...validRequest, agentName: '  Support Agent  ' })).toEqual(
      validRequest
    );
  });

  it.each([
    ['unknown field', { ...validRequest, debug: true }],
    ['invalid agent id', { ...validRequest, agentId: 'not-a-uuid' }],
    ['empty agent name', { ...validRequest, agentName: '   ' }],
    ['unsafe agent name', { ...validRequest, agentName: 'Agent\u0000Name' }],
    ['invalid calendar date', { ...validRequest, startDate: '2026-02-30' }],
    ['reversed date range', { ...validRequest, startDate: '2026-09-01' }],
    ['oversized date range', { ...validRequest, startDate: '2025-01-01' }],
    ['unknown KPI', { ...validRequest, kpiStats: { ...validRequest.kpiStats, secret: 1 } }],
    ['negative count', { ...validRequest, kpiStats: { ...validRequest.kpiStats, resolvedCount: -1 } }],
    ['fractional count', { ...validRequest, kpiStats: { ...validRequest.kpiStats, totalClaimed: 20.5 } }],
    ['invalid SLA rate', { ...validRequest, kpiStats: { ...validRequest.kpiStats, slaComplianceRate: 101 } }],
    ['invalid CSAT', { ...validRequest, kpiStats: { ...validRequest.kpiStats, avgCsat: 6 } }],
    ['non-finite metric', { ...validRequest, kpiStats: { ...validRequest.kpiStats, avgResolutionTime: Infinity } }],
  ])('rejects an untrusted request: %s', (_label, request) => {
    expect(() => parseStaffEvaluationRequest(request)).toThrow(TypeError);
  });
});

describe('parseStaffEvaluationQuery', () => {
  it('accepts an omitted or strict force flag', () => {
    expect(parseStaffEvaluationQuery(new URLSearchParams())).toEqual({ force: false });
    expect(parseStaffEvaluationQuery(new URLSearchParams('force=true'))).toEqual({ force: true });
    expect(parseStaffEvaluationQuery(new URLSearchParams('force=false'))).toEqual({ force: false });
  });

  it.each(['force=1', 'force=true&force=false', 'debug=true'])('rejects query %s', (query) => {
    expect(() => parseStaffEvaluationQuery(new URLSearchParams(query))).toThrow(TypeError);
  });
});

describe('parseGeneratedStaffEvaluation', () => {
  const validEvaluation = {
    dimensions: {
      speed: { rating: 88, feedback: 'Fast and consistent.' },
      quality: { rating: 92, feedback: 'Accurate resolutions.' },
      sla: { rating: 95, feedback: 'Strong SLA compliance.' },
      csat: { rating: 90, feedback: 'Positive customer feedback.' },
    },
    strengths: ['Clear communication', 'Structured troubleshooting'],
    recommendations: ['Share more knowledge with the team'],
    overallSummary: 'A strong performance during the evaluation period.',
  };

  it('accepts the exact bounded model-output contract', () => {
    expect(parseGeneratedStaffEvaluation(validEvaluation)).toEqual(validEvaluation);
  });

  it.each([
    ['unexpected field', { ...validEvaluation, rawPrompt: 'secret' }],
    ['missing dimension', { ...validEvaluation, dimensions: { ...validEvaluation.dimensions, csat: undefined } }],
    ['unexpected dimension field', {
      ...validEvaluation,
      dimensions: {
        ...validEvaluation.dimensions,
        speed: { ...validEvaluation.dimensions.speed, debug: true },
      },
    }],
    ['out-of-range rating', {
      ...validEvaluation,
      dimensions: {
        ...validEvaluation.dimensions,
        speed: { ...validEvaluation.dimensions.speed, rating: 101 },
      },
    }],
    ['oversized feedback', {
      ...validEvaluation,
      dimensions: {
        ...validEvaluation.dimensions,
        speed: { ...validEvaluation.dimensions.speed, feedback: 'x'.repeat(2001) },
      },
    }],
    ['too many strengths', { ...validEvaluation, strengths: Array.from({ length: 6 }, () => 'Strong') }],
    ['empty recommendation', { ...validEvaluation, recommendations: [''] }],
    ['oversized summary', { ...validEvaluation, overallSummary: 'x'.repeat(5001) }],
  ])('rejects untrusted model output: %s', (_label, evaluation) => {
    expect(() => parseGeneratedStaffEvaluation(evaluation)).toThrow(TypeError);
  });
});
