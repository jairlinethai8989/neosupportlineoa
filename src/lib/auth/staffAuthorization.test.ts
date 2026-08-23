import { describe, expect, it } from 'vitest';
import { hasStaffAccess } from './staffAuthorization';

describe('hasStaffAccess', () => {
  it('allows only canonical staff roles', () => {
    expect(hasStaffAccess({ role: 'Agent', permissions: {} })).toBe(true);
    expect(hasStaffAccess({ role: 'Administrator', permissions: {} })).toBe(true);
    expect(hasStaffAccess({ role: 'Customer', permissions: {} })).toBe(false);
    expect(hasStaffAccess(null)).toBe(false);
  });

  it('enforces view and edit permission levels while administrators bypass module grants', () => {
    const viewer = { role: 'Agent', permissions: { reports: 'view' } };
    const editor = { role: 'Agent', permissions: { reports: 'edit' } };

    expect(hasStaffAccess(viewer, { permission: 'reports', level: 'view' })).toBe(true);
    expect(hasStaffAccess(viewer, { permission: 'reports', level: 'edit' })).toBe(false);
    expect(hasStaffAccess(editor, { permission: 'reports', level: 'view' })).toBe(true);
    expect(hasStaffAccess(editor, { permission: 'reports', level: 'edit' })).toBe(true);
    expect(
      hasStaffAccess(
        { role: 'Administrator', permissions: {} },
        { permission: 'reports', level: 'edit' }
      )
    ).toBe(true);
  });

  it('can require an administrator explicitly', () => {
    expect(hasStaffAccess({ role: 'Agent', permissions: {} }, { roles: ['Administrator'] })).toBe(false);
    expect(
      hasStaffAccess({ role: 'Administrator', permissions: {} }, { roles: ['Administrator'] })
    ).toBe(true);
  });
});
