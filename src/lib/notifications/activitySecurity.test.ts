import { describe, expect, it } from 'vitest';
import { parseNotificationActivityCursor } from './activitySecurity';

describe('parseNotificationActivityCursor', () => {
  const now = Date.parse('2026-08-23T12:00:00.000Z');

  it('accepts a recent ISO timestamp', () => {
    expect(parseNotificationActivityCursor('2026-08-23T11:59:30.000Z', now))
      .toBe('2026-08-23T11:59:30.000Z');
  });

  it('bounds old cursors to five minutes', () => {
    expect(parseNotificationActivityCursor('2020-01-01T00:00:00.000Z', now))
      .toBe('2026-08-23T11:55:00.000Z');
  });

  it('rejects invalid and far-future cursors', () => {
    expect(() => parseNotificationActivityCursor('not-a-date', now)).toThrow();
    expect(() => parseNotificationActivityCursor('2026-08-23T12:02:00.000Z', now)).toThrow();
  });
});
