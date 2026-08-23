import { describe, expect, it } from 'vitest';
import { authorizeHandoffAccess, generateSecurePin, hashHandoffCredential, parseHandoffToken } from './handoffAccess';

describe('authorizeHandoffAccess', () => {
  it('rejects an expired handoff even when the PIN is correct', () => {
    expect(authorizeHandoffAccess({
      suppliedPin: '2468',
      storedPin: '2468',
      status: 'Active',
      expiresAt: '2026-08-10T00:00:00.000Z',
      now: new Date('2026-08-10T00:00:01.000Z'),
    })).toEqual({ allowed: false, reason: 'expired' });
  });
});

describe('parseHandoffToken', () => {
  it('accepts a generated UUID as a token rather than treating it as a ticket identifier', () => {
    expect(parseHandoffToken('123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567-e89b-12d3-a456-426614174000');
  });
});

describe('generateSecurePin', () => {
  it('always produces a four-digit PIN using the supplied cryptographic range', () => {
    expect(generateSecurePin(() => 0)).toBe('1000');
    expect(generateSecurePin(() => 8999)).toBe('9999');
  });
});

describe('hashHandoffCredential', () => {
  it('domain-separates token and PIN hashes even when their raw value is identical', () => {
    const pepper = '0123456789abcdef0123456789abcdef';
    const tokenHash = hashHandoffCredential('token', '12345678', pepper);
    const pinHash = hashHandoffCredential('pin', '12345678', pepper);

    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(pinHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toBe(pinHash);
    expect(tokenHash).not.toContain('12345678');
  });
});
