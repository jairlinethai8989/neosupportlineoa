import { describe, expect, it } from 'vitest';
import { createPortalSurveyPath } from './surveyPath';

describe('createPortalSurveyPath', () => {
  it('creates an ownership-checked Portal survey path for a ticket UUID', () => {
    expect(createPortalSurveyPath('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '/portal?survey_ticket_id=550e8400-e29b-41d4-a716-446655440000'
    );
  });

  it.each([
    '',
    'not-a-uuid',
    '../admin',
    '550e8400-e29b-41d4-a716-446655440000&admin=true',
  ])('falls back to the Portal root for an invalid ticket id: %s', (ticketId) => {
    expect(createPortalSurveyPath(ticketId)).toBe('/portal');
  });
});
