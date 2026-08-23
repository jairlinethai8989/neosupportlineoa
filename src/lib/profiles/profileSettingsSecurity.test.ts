import { describe, expect, it } from 'vitest';
import { parseOwnProfileSettings } from './profileSettingsSecurity';

describe('parseOwnProfileSettings', () => {
  it('returns only the allowlisted, normalized self-service fields', () => {
    expect(parseOwnProfileSettings({
      full_name: '  NEO Agent  ',
      avatar_url: 'https://example.com/avatar.webp',
      department: 'Support',
      landing_page: 'inbox',
      theme_color: '#00f2fe',
      signature_url: null,
      quick_replies: ['Hello'],
      resolution_templates: ['Resolved'],
      auto_logout_minutes: 30,
      role: 'Administrator',
    })).toEqual({
      full_name: 'NEO Agent',
      avatar_url: 'https://example.com/avatar.webp',
      department: 'Support',
      landing_page: 'inbox',
      theme_color: '#00f2fe',
      signature_url: null,
      quick_replies: ['Hello'],
      resolution_templates: ['Resolved'],
      auto_logout_minutes: 30,
    });
  });
});
