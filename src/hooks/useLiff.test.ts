import { describe, expect, it } from 'vitest';
import { canUseMockLogin } from './useLiff';

describe('useLiff guards', () => {
  it('exports mock-login guard as boolean', () => {
    expect(typeof canUseMockLogin).toBe('boolean');
  });
});
