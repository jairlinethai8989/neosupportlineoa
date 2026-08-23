import { describe, expect, it } from 'vitest';
import {
  parseEvaluation360Post,
  parseEvaluation360Query,
  parseEvaluation360Read,
  parseGeneratedEvaluation360,
} from './staffEvaluation360';

describe('parseGeneratedEvaluation360', () => {
  it('accepts bounded model output and rejects out-of-range scores', () => {
    const scores = {
      system_data_expertise: 4,
      troubleshooting_sla: 5,
      shift_availability: 3,
      handover_quality: 4,
      knowledge_sharing: 4,
      crisis_communication: 5,
      emotional_regulation: 4,
      learning_agility: 5,
    };

    expect(parseGeneratedEvaluation360({ scores, comments: '  Useful feedback  ' })).toEqual({
      scores,
      comments: 'Useful feedback',
      is_ai_generated: true,
    });
    expect(() =>
      parseGeneratedEvaluation360({ scores: { ...scores, learning_agility: 99 }, comments: '' })
    ).toThrow('Invalid evaluation score');
  });
});

describe('parseEvaluation360Query', () => {
  it('accepts only a valid staff id and monthly period', () => {
    expect(
      parseEvaluation360Query('10000000-0000-4000-8000-000000000001', '2026-08')
    ).toEqual({
      agentId: '10000000-0000-4000-8000-000000000001',
      period: '2026-08',
    });

    expect(() => parseEvaluation360Query('not-a-uuid', '2026-08')).toThrow('Invalid agent id');
    expect(() => parseEvaluation360Query('10000000-0000-4000-8000-000000000001', '2026-13')).toThrow(
      'Invalid evaluation period'
    );
  });
});

describe('parseEvaluation360Post', () => {
  it('accepts and normalizes a valid self-evaluation', () => {
    expect(
      parseEvaluation360Post({
        action: 'save',
        agentId: '10000000-0000-4000-8000-000000000001',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        period: '2026-08',
        evaluatorRole: 'self',
        evaluationData: {
          system_data_expertise: 4,
          troubleshooting_sla: 5,
          shift_availability: 3,
          handover_quality: 4,
          knowledge_sharing: 4,
          crisis_communication: 5,
          emotional_regulation: 4,
          learning_agility: 5,
          comments: '  Monthly self review  ',
          is_ai_generated: false,
        },
      })
    ).toMatchObject({
      action: 'save',
      evaluatorRole: 'self',
      evaluationData: { comments: 'Monthly self review' },
    });
  });

  it('rejects invalid scores, roles, date ranges, and extra fields', () => {
    const valid = {
      action: 'generate-ai',
      agentId: '10000000-0000-4000-8000-000000000001',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      period: '2026-08',
    };

    expect(() => parseEvaluation360Post({ ...valid, endDate: '2026-07-31' })).toThrow('Invalid date range');
    expect(() => parseEvaluation360Post({ ...valid, evaluatorRole: 'owner' })).toThrow('Unknown field');
    expect(() => parseEvaluation360Post({ ...valid, includeSecrets: true })).toThrow('Unknown field');

    expect(() =>
      parseEvaluation360Post({
        ...valid,
        action: 'save',
        evaluatorRole: 'self',
        evaluationData: {
          system_data_expertise: 6,
          troubleshooting_sla: 5,
          shift_availability: 3,
          handover_quality: 4,
          knowledge_sharing: 4,
          crisis_communication: 5,
          emotional_regulation: 4,
          learning_agility: 5,
          comments: '',
        },
      })
    ).toThrow('Invalid evaluation score');
  });
});

describe('parseEvaluation360Read', () => {
  it('accepts exact read fields and rejects role or field injection', () => {
    const valid = {
      agentId: '10000000-0000-4000-8000-000000000001',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      period: '2026-08',
      evaluatorRole: 'self',
    };
    expect(parseEvaluation360Read(valid)).toEqual(valid);
    expect(() => parseEvaluation360Read({ ...valid, evaluatorRole: 'owner' })).toThrow('Invalid evaluator role');
    expect(() => parseEvaluation360Read({ ...valid, evaluatorId: valid.agentId })).toThrow('Unknown field');
  });
});
