import { describe, expect, it } from 'vitest';
import { toOwnProfileDto, toStaffDirectoryDto, toStaffManagementDto } from './profileReadSecurity';

describe('profile read DTOs', () => {
  it('returns self-service fields without leaking protected or future columns', () => {
    const result = toOwnProfileDto({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'agent@example.invalid',
      full_name: 'Agent One',
      role: 'Agent',
      permissions: { inbox: 'edit' },
      quick_replies: ['Hello'],
      password_hash: 'secret',
      future_private_token: 'secret',
    });

    expect(result).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'agent@example.invalid',
      full_name: 'Agent One',
      role: 'Agent',
      permissions: { inbox: 'edit' },
      quick_replies: ['Hello'],
    });
    expect(result).not.toHaveProperty('password_hash');
    expect(result).not.toHaveProperty('future_private_token');
  });

  it('returns only public presence fields for other staff', () => {
    expect(toStaffDirectoryDto({
      id: '22222222-2222-4222-8222-222222222222',
      full_name: 'Agent Two',
      avatar_url: 'https://example.invalid/avatar.webp',
      status: 'Active',
      department: 'Support',
      email: 'private@example.invalid',
      permissions: { settings_staff: 'edit' },
    })).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      full_name: 'Agent Two',
      avatar_url: 'https://example.invalid/avatar.webp',
      status: 'Active',
      department: 'Support',
    });
  });

  it('returns only fields required for authorized staff administration', () => {
    const result = toStaffManagementDto({
      id: '22222222-2222-4222-8222-222222222222',
      full_name: 'Agent Two',
      email: 'agent@example.invalid',
      avatar_url: null,
      department: 'Support',
      role: 'Agent',
      status: 'Active',
      permissions: { inbox: 'edit' },
      signature_url: 'https://private.invalid/signature.png',
    });
    expect(result).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      full_name: 'Agent Two',
      email: 'agent@example.invalid',
      avatar_url: null,
      department: 'Support',
      role: 'Agent',
      status: 'Active',
      permissions: { inbox: 'edit' },
    });
  });
});
