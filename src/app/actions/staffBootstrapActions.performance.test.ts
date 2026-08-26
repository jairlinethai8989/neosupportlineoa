import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  requireStaffAuth: vi.fn().mockResolvedValue({
    user: { id: 'staff-id' },
    profile: { role: 'Administrator', permissions: {} },
  }),
}));

const rowsByTable: Record<string, Record<string, unknown> | Array<Record<string, unknown>>> = {
  profiles: {
    id: 'staff-id',
    email: 'staff@example.test',
    role: 'Administrator',
    full_name: 'Admin User',
    permissions: {},
  },
  company_settings: {
    id: 'settings-id',
    company_name: 'Neo Support',
    gemini_api_key: 'must-not-reach-client',
  },
  ticket_modules: [{ name: 'ERP' }],
  ticket_issue_types: [{ name: 'Error' }],
  ticket_subject_types: [{ name: 'ใช้งานไม่ได้' }],
};

function queryFor(table: string) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => ({
    data: rowsByTable[table] || null,
    error: null,
  }));
  builder.then = (
    resolve: (value: { data: unknown; error: null }) => unknown,
    reject: (reason?: unknown) => unknown
  ) => Promise.resolve({ data: rowsByTable[table] || [], error: null }).then(resolve, reject);
  return builder;
}

vi.mock('@/lib/auth/staffAuthorization', () => ({
  requireStaffAuth: auth.requireStaffAuth,
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => queryFor(table)),
  },
}));

import * as profileActions from './profileSettingsActions';

describe('Staff first-load bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the safe first-load payload through one staff authorization boundary', async () => {
    const action = (profileActions as typeof profileActions & {
      getStaffBootstrapAction?: () => Promise<{
        profile: Record<string, unknown>;
        companySettings: Record<string, unknown>;
        ticketOptions: { modules: string[]; issueTypes: string[]; subjectTypes: string[] };
      }>;
    }).getStaffBootstrapAction;

    expect(action).toBeTypeOf('function');
    const result = await action!();

    expect(auth.requireStaffAuth).toHaveBeenCalledTimes(1);
    expect(result.profile).toMatchObject({ id: 'staff-id', full_name: 'Admin User' });
    expect(result.companySettings).toMatchObject({ company_name: 'Neo Support' });
    expect(result.companySettings).not.toHaveProperty('gemini_api_key');
    expect(result.ticketOptions).toEqual({
      modules: ['ERP'],
      issueTypes: ['Error'],
      subjectTypes: ['ใช้งานไม่ได้'],
    });
  });
});
