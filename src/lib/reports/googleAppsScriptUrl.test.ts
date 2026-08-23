import { describe, expect, it } from 'vitest';
import {
  parseGoogleAppsScriptTargetUrl,
  resolveGoogleAppsScriptRedirect,
} from './googleAppsScriptUrl';

describe('Google Apps Script outbound URL validation', () => {
  it('accepts a deployed HTTPS web app and its Google content redirect', () => {
    const target = parseGoogleAppsScriptTargetUrl(
      'https://script.google.com/macros/s/AKfycbx_deployment-123/exec'
    );
    expect(target).toBe('https://script.google.com/macros/s/AKfycbx_deployment-123/exec');

    expect(
      resolveGoogleAppsScriptRedirect(
        '/macros/echo?user_content_key=one-time',
        'https://script.googleusercontent.com/'
      )
    ).toBe('https://script.googleusercontent.com/macros/echo?user_content_key=one-time');
  });

  it('rejects non-Google, insecure, credentialed, and deceptive destinations', () => {
    for (const value of [
      'http://script.google.com/macros/s/deployment/exec',
      'https://localhost/macros/s/deployment/exec',
      'https://script.google.com.evil.example/macros/s/deployment/exec',
      'https://user:pass@script.google.com/macros/s/deployment/exec',
      'https://script.google.com/admin',
    ]) {
      expect(() => parseGoogleAppsScriptTargetUrl(value)).toThrow('Invalid Google Apps Script URL');
    }

    expect(() =>
      resolveGoogleAppsScriptRedirect('http://169.254.169.254/latest/meta-data', 'https://script.google.com/')
    ).toThrow('Invalid Google Apps Script redirect');
    expect(() =>
      resolveGoogleAppsScriptRedirect('https://script.googleusercontent.com.evil.example/steal', 'https://script.google.com/')
    ).toThrow('Invalid Google Apps Script redirect');
  });
});
