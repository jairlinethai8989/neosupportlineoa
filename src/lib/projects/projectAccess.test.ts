import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}));

import { resolveScopedProjectIds } from './projectAccess';

describe('resolveScopedProjectIds RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows multi-project agent to view their assigned projects and blocks unauthorized project', async () => {
    const projectA = {
      id: 'proj-a',
      slug: 'proj-a',
      name: 'Project A',
      code: 'PA',
      organization_label: 'หน่วยงาน',
      logo_url: null,
      primary_color: '#0066ff',
      line_liff_id: null,
      line_bot_id: null,
      line_staff_group_id: null,
      notify_on_customer_message: false,
      is_default: true,
      is_active: true,
    };
    const projectB = {
      ...projectA,
      id: 'proj-b',
      slug: 'proj-b',
      name: 'Project B',
      code: 'PB',
      is_default: false,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: 'Agent' } }),
            }),
          }),
        };
      }
      if (table === 'project_members') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { project_role: 'agent', projects: projectA },
                { project_role: 'lead', projects: projectB },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const allScope = await resolveScopedProjectIds('user-agent-1', 'all');
    expect(allScope.projectIds).toEqual(['proj-a', 'proj-b']);

    const bScope = await resolveScopedProjectIds('user-agent-1', 'proj-b');
    expect(bScope.projectIds).toEqual(['proj-b']);

    await expect(resolveScopedProjectIds('user-agent-1', 'proj-c')).rejects.toThrow(
      'Forbidden: You do not have access to the requested project'
    );
  });

  it('grants unrestricted project scope for Administrator when requesting all', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: 'Administrator' } }),
            }),
          }),
        };
      }
      if (table === 'projects') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                order: async () => ({
                  data: [{ id: 'proj-a', slug: 'a', name: 'A', code: 'A', is_default: true, is_active: true }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const adminAll = await resolveScopedProjectIds('user-admin-1', 'all');
    expect(adminAll.projectIds).toBeNull();

    const adminSpecific = await resolveScopedProjectIds('user-admin-1', 'proj-c');
    expect(adminSpecific.projectIds).toEqual(['proj-c']);
  });
});
