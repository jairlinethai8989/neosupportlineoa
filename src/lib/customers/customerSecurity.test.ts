import { describe, expect, it } from 'vitest';
import { parseCustomerId, toCustomerDto } from './customerSecurity';

describe('customer read security', () => {
  it('validates customer IDs', () => {
    expect(parseCustomerId('11111111-1111-4111-8111-111111111111')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(() => parseCustomerId('../profiles')).toThrow('Invalid customer id');
  });

  it('returns only allowlisted customer and organization fields', () => {
    const result = toCustomerDto({
      id: '11111111-1111-4111-8111-111111111111',
      display_name: 'Customer',
      line_user_id: 'U123',
      organizations: { name: 'Hospital A', private_token: 'secret' },
      future_private_token: 'secret',
    });
    expect(result).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      display_name: 'Customer',
      line_user_id: 'U123',
      organizations: { name: 'Hospital A' },
    });
    expect(result).not.toHaveProperty('future_private_token');
    expect(result.organizations).not.toHaveProperty('private_token');
  });
});
