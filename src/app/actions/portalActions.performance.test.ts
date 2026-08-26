import { beforeEach, describe, expect, it, vi } from 'vitest';

const identity = vi.hoisted(() => ({
  verifyLineIdToken: vi.fn().mockResolvedValue({
    lineUserId: 'U1234567890',
    displayName: 'Portal Customer',
    pictureUrl: 'https://example.test/avatar.png',
  }),
}));

const dbState = vi.hoisted(() => ({
  ticketQueryCount: 0,
  customerUpsertCount: 0,
  customerUpsertPayload: null as Record<string, unknown> | null,
  existingCustomer: null as typeof syncedCustomer | null,
}));

const syncedCustomer = {
  id: 'customer-id',
  display_name: 'Portal Customer',
  full_name: null,
  line_username: 'Portal Customer',
  organization_id: null,
  department_id: null,
  position_id: null,
  organizations: null,
};

function queryFor(table: string) {
  const queryIndex = table === 'tickets' ? dbState.ticketQueryCount++ : -1;
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'not', 'order', 'range', 'limit', 'or']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.upsert = vi.fn((payload: Record<string, unknown>) => {
    dbState.customerUpsertCount += 1;
    dbState.customerUpsertPayload = payload;
    return builder;
  });
  builder.maybeSingle = vi.fn(async () => ({
    data: table === 'customers' ? dbState.existingCustomer : null,
    error: null,
  }));
  builder.single = vi.fn(async () => ({
    data: table === 'customers' ? syncedCustomer : null,
    error: null,
  }));
  builder.then = (
    resolve: (value: { data: unknown[]; error: null; count?: number }) => unknown,
    reject: (reason?: unknown) => unknown
  ) => Promise.resolve({
    data: [],
    error: null,
    ...(table === 'tickets' && queryIndex === 1 ? { count: 0 } : {}),
  }).then(resolve, reject);
  return builder;
}

vi.mock('@/lib/portal/lineIdentity', () => ({
  verifyLineIdToken: identity.verifyLineIdToken,
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => queryFor(table)),
    storage: { from: vi.fn() },
  },
}));

import { getPortalHomeAction } from './portalActions';

describe('Portal home first-load bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.ticketQueryCount = 0;
    dbState.customerUpsertCount = 0;
    dbState.customerUpsertPayload = null;
    dbState.existingCustomer = null;
    process.env.LINE_LOGIN_CHANNEL_ID = '1234567890';
  });

  it('verifies LINE once and synchronizes a new customer in the home request', async () => {
    const result = await getPortalHomeAction('verified-line-id-token');

    expect(identity.verifyLineIdToken).toHaveBeenCalledTimes(1);
    expect(dbState.customerUpsertCount).toBe(1);
    expect(dbState.customerUpsertPayload).toMatchObject({
      line_user_id: 'U1234567890',
      display_name: 'Portal Customer',
    });
    expect(result.customer).toEqual(syncedCustomer);
  });

  it('does not rewrite an existing customer during a home refresh', async () => {
    dbState.existingCustomer = syncedCustomer;

    const result = await getPortalHomeAction('verified-line-id-token');

    expect(identity.verifyLineIdToken).toHaveBeenCalledTimes(1);
    expect(dbState.customerUpsertCount).toBe(0);
    expect(result.customer).toEqual(syncedCustomer);
  });
});
