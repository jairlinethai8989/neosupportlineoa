import { describe, expect, it } from 'vitest';
import { isAuthorizedCronRequest } from './cronAuthorization';

describe('cron authorization', () => {
  it('accepts only the configured secret as a Bearer token', () => {
    const secret = 'a-random-secret-value';

    expect(
      isAuthorizedCronRequest(
        new Request('https://example.test/api/cron/daily-summary', {
          headers: { authorization: `Bearer ${secret}` },
        }),
        secret
      )
    ).toBe(true);

    expect(
      isAuthorizedCronRequest(
        new Request(`https://example.test/api/cron/daily-summary?key=${secret}`),
        secret
      )
    ).toBe(false);
  });

  it('fails closed when the cron secret is missing', () => {
    const request = new Request('https://example.test/api/cron/daily-summary', {
      headers: { authorization: 'Bearer undefined' },
    });

    expect(isAuthorizedCronRequest(request, undefined)).toBe(false);
  });
});
