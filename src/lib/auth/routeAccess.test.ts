import { describe, expect, it } from 'vitest';
import { isPublicRequestPath, sanitizeInternalRedirect } from './routeAccess';

describe('isPublicRequestPath', () => {
  it('allows only the intended public route boundaries', () => {
    expect(isPublicRequestPath('/login')).toBe(true);
    expect(isPublicRequestPath('/portal')).toBe(true);
    expect(isPublicRequestPath('/portal/tickets/123')).toBe(true);
    expect(isPublicRequestPath('/survey/123')).toBe(true);
    expect(isPublicRequestPath('/escalate/123')).toBe(true);
    expect(isPublicRequestPath('/line/imagemap-portal-menu/1040')).toBe(true);
    expect(isPublicRequestPath('/api/line/webhook')).toBe(true);
    expect(isPublicRequestPath('/api/cron/daily-summary')).toBe(true);

    expect(isPublicRequestPath('/portal-evil')).toBe(false);
    expect(isPublicRequestPath('/login/evil')).toBe(false);
    expect(isPublicRequestPath('/api/line/webhook/evil')).toBe(false);
    expect(isPublicRequestPath('/api/cron/evil')).toBe(false);
    expect(isPublicRequestPath('/tickets')).toBe(false);
  });
});

describe('sanitizeInternalRedirect', () => {
  it('keeps safe application-relative destinations', () => {
    expect(sanitizeInternalRedirect('/tickets/123?tab=history')).toBe('/tickets/123?tab=history');
  });

  it('rejects absolute, protocol-relative, script, and backslash destinations', () => {
    for (const value of [
      'https://evil.example/phish',
      '//evil.example/phish',
      'javascript:alert(1)',
      '\\evil.example\\phish',
      ' /tickets',
    ]) {
      expect(sanitizeInternalRedirect(value, '/inbox')).toBe('/inbox');
    }
  });
});
