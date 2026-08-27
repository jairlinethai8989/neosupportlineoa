import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  requireStaffAuth: vi.fn().mockResolvedValue({
    user: { id: 'staff-id' },
    profile: { role: 'Administrator', permissions: { customers: 'view' } },
  }),
}));

const selectedColumns = vi.hoisted(() => [] as string[]);

const productionCustomer = {
  id: '11111111-1111-4111-8111-111111111111',
  display_name: 'LINE Customer',
  full_name: 'Customer One',
  line_username: 'customer.one',
  line_user_id: 'U123',
  status: 'active',
  organization_id: null,
  department_id: null,
  position_id: null,
  created_at: '2026-08-26T00:00:00.000Z',
  metadata: {
    line_profile: { picture_url: 'https://example.test/avatar.png' },
  },
};

function customerQuery() {
  let select = '';
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn((columns: string) => {
    select = columns;
    selectedColumns.push(columns);
    return builder;
  });
  builder.order = vi.fn(() => builder);
  builder.then = (
    resolve: (value: { data: unknown[] | null; error: Record<string, string> | null }) => unknown,
    reject: (reason?: unknown) => unknown
  ) => Promise.resolve(
    select.includes('avatar_url')
      ? { data: null, error: { code: '42703', message: 'column customers.avatar_url does not exist' } }
      : { data: [productionCustomer], error: null }
  ).then(resolve, reject);
  return builder;
}

vi.mock('@/lib/auth/staffAuthorization', () => ({
  requireStaffAuth: auth.requireStaffAuth,
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: vi.fn(() => customerQuery()) },
}));

import { getCustomersAction } from './customerActions';

describe('customer list production-schema compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedColumns.length = 0;
  });

  it('falls back without avatar_url and preserves the LINE profile picture from metadata', async () => {
    const result = await getCustomersAction();

    expect(auth.requireStaffAuth).toHaveBeenCalledTimes(1);
    expect(selectedColumns).toHaveLength(2);
    expect(selectedColumns[0]).toContain('avatar_url');
    expect(selectedColumns[1]).not.toContain('avatar_url');
    expect(selectedColumns[1]).toContain('metadata');
    expect(result).toEqual([
      expect.objectContaining({
        id: productionCustomer.id,
        display_name: 'LINE Customer',
        avatar_url: 'https://example.test/avatar.png',
      }),
    ]);
  });
});
