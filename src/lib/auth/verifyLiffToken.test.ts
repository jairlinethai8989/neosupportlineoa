import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyLiffIdentity } from './verifyLiffToken';

describe('verifyLiffIdentity', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('verifies a valid LINE LIFF idToken via LINE OAuth2 verify endpoint', async () => {
    process.env.NEXT_PUBLIC_LIFF_ID = '2001234567-AbCdEfGh';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sub: 'U_VERIFIED_123' }),
    } as Response);

    const result = await verifyLiffIdentity({
      lineUserId: 'U_IGNORED_CLIENT_VALUE',
      idToken: 'valid.jwt.token',
    });

    expect(result).toEqual({ lineUserId: 'U_VERIFIED_123', verified: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects when LINE OAuth2 verify endpoint returns non-OK', async () => {
    process.env.NEXT_PUBLIC_LIFF_ID = '2001234567-AbCdEfGh';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    } as Response);

    await expect(
      verifyLiffIdentity({ lineUserId: 'U_TEST', idToken: 'bad.token' })
    ).rejects.toThrow('Invalid or expired LINE LIFF token');
  });

  it('allows fallback lineUserId when mock mode is enabled and idToken is omitted', async () => {
    process.env.NEXT_PUBLIC_LIFF_ID = '2001234567-AbCdEfGh';
    process.env.NEXT_PUBLIC_ENABLE_LIFF_MOCK = 'true';

    const result = await verifyLiffIdentity({
      lineUserId: 'U_MOCK_USER',
      idToken: null,
    });

    expect(result).toEqual({ lineUserId: 'U_MOCK_USER', verified: false });
  });

  it('uses per-project liffId channel ID instead of env default when verifying multi-OA token', async () => {
    process.env.NEXT_PUBLIC_LIFF_ID = '2001234567-DefaultLiff';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sub: 'U_PROJECT_TWO' }),
    } as Response);

    const result = await verifyLiffIdentity({
      lineUserId: 'U_IGNORED',
      idToken: 'project2.jwt.token',
      liffId: '2009998888-ProjectTwo',
    });

    expect(result).toEqual({ lineUserId: 'U_PROJECT_TWO', verified: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.line.me/oauth2/v2.1/verify',
      expect.objectContaining({
        method: 'POST',
        body: 'id_token=project2.jwt.token&client_id=2009998888',
      })
    );
  });
});
