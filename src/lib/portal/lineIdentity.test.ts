import { describe, expect, it, vi } from 'vitest';
import { verifyLineIdToken } from './lineIdentity';

describe('LINE identity verification', () => {
  it('derives the trusted LINE user ID from a verified ID token', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        iss: 'https://access.line.me',
        sub: 'U1234567890',
        aud: '1234567890',
        exp: Math.floor(Date.now() / 1000) + 300,
        name: 'Portal Customer',
        picture: 'https://example.test/avatar.png',
      })
    );

    const identity = await verifyLineIdToken('raw-id-token', '1234567890', fetcher);

    expect(identity).toEqual({
      lineUserId: 'U1234567890',
      displayName: 'Portal Customer',
      pictureUrl: 'https://example.test/avatar.png',
    });
  });

  it('rejects a token whose verified audience does not match the configured channel', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        iss: 'https://access.line.me',
        sub: 'U1234567890',
        aud: 'attacker-channel',
        exp: Math.floor(Date.now() / 1000) + 300,
      })
    );

    await expect(
      verifyLineIdToken('raw-id-token', 'expected-channel', fetcher)
    ).rejects.toThrow('Unauthorized');
  });

  it('rejects an expired verified token', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        iss: 'https://access.line.me',
        sub: 'U1234567890',
        aud: '1234567890',
        exp: Math.floor(Date.now() / 1000) - 1,
      })
    );

    await expect(
      verifyLineIdToken('expired-token', '1234567890', fetcher)
    ).rejects.toThrow('Unauthorized');
  });

  it('rejects a token that LINE cannot verify', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ error: 'invalid token' }, { status: 400 })
    );

    await expect(
      verifyLineIdToken('invalid-token', '1234567890', fetcher)
    ).rejects.toThrow('Unauthorized');
  });
});
