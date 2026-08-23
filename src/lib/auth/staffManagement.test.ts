import { describe, expect, it } from 'vitest';
import { parseStaffCreate, parseStaffPermissionUpdate } from './staffManagement';

describe('parseStaffCreate', () => {
  it('normalizes an allowlisted staff account request', () => {
    expect(
      parseStaffCreate({
        username: '  Agent.One  ',
        password: 'correct-horse-battery-staple',
        full_name: '  Agent One  ',
        role: 'Agent',
        department: '  Support  ',
      })
    ).toEqual({
      username: 'agent.one',
      password: 'correct-horse-battery-staple',
      fullName: 'Agent One',
      role: 'Agent',
      department: 'Support',
    });
  });

  it('rejects account injection, weak credentials, and unknown roles', () => {
    const valid = {
      username: 'agent.one',
      password: 'correct-horse-battery-staple',
      full_name: 'Agent One',
      role: 'Agent',
      department: 'Support',
    };

    expect(() => parseStaffCreate({ ...valid, username: 'admin@example.com' })).toThrow('Invalid username');
    expect(() => parseStaffCreate({ ...valid, password: 'short' })).toThrow('Invalid password');
    expect(() => parseStaffCreate({ ...valid, role: 'Owner' })).toThrow('Invalid role');
    expect(() => parseStaffCreate({ ...valid, permissions: { settings_staff: 'edit' } })).toThrow('Unknown field');
  });
});

describe('parseStaffPermissionUpdate', () => {
  it('accepts canonical permission levels for a valid staff id', () => {
    expect(
      parseStaffPermissionUpdate({
        id: '10000000-0000-4000-8000-000000000001',
        permissions: { tickets: 'edit', reports: 'view', settings_staff: 'none' },
      })
    ).toEqual({
      id: '10000000-0000-4000-8000-000000000001',
      permissions: { tickets: 'edit', reports: 'view', settings_staff: 'none' },
    });
  });

  it('rejects unknown permission keys and levels', () => {
    expect(() =>
      parseStaffPermissionUpdate({
        id: '10000000-0000-4000-8000-000000000001',
        permissions: { role: 'Administrator' },
      })
    ).toThrow('Invalid permissions');

    expect(() =>
      parseStaffPermissionUpdate({
        id: '10000000-0000-4000-8000-000000000001',
        permissions: { tickets: 'owner' },
      })
    ).toThrow('Invalid permissions');
  });
});
