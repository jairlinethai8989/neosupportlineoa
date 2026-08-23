const MAX_CURSOR_AGE_MS = 5 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;

export function parseNotificationActivityCursor(value: unknown, now = Date.now()) {
  if (typeof value !== 'string') throw new Error('Invalid notification cursor');
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid notification cursor');
  if (timestamp > now + MAX_FUTURE_SKEW_MS) throw new Error('Invalid notification cursor');
  return new Date(Math.max(timestamp, now - MAX_CURSOR_AGE_MS)).toISOString();
}
