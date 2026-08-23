import { describe, expect, it } from 'vitest';
import {
  getGeminiKeyStatus,
  parseBrandingSettingsInput,
  parseGeminiApiKey,
  parseGoogleSheetsUrl,
  toClientCompanySettings,
} from './companySettingsSecurity';

describe('toClientCompanySettings', () => {
  it('returns only allowlisted browser settings and excludes database secrets', () => {
    const result = toClientCompanySettings({
      id: 7,
      company_name: 'NEO SUPPORT',
      logo_url: 'https://example.invalid/logo.png',
      modules: ['ERP'],
      gemini_api_key: 'gemini-secret',
      future_private_token: 'future-secret',
    });

    expect(result).toEqual({
      id: 7,
      company_name: 'NEO SUPPORT',
      logo_url: 'https://example.invalid/logo.png',
      modules: ['ERP'],
    });
    expect(result).not.toHaveProperty('gemini_api_key');
    expect(result).not.toHaveProperty('future_private_token');
  });
});

describe('getGeminiKeyStatus', () => {
  it('reports configuration state without returning the stored key', () => {
    const result = getGeminiKeyStatus({ gemini_api_key: '  gemini-secret  ' });

    expect(result).toEqual({ configured: true });
    expect(JSON.stringify(result)).not.toContain('gemini-secret');
  });
});

describe('parseGeminiApiKey', () => {
  it('accepts a bounded API key token and trims surrounding whitespace', () => {
    expect(parseGeminiApiKey('  AIzaSyExampleKey_1234567890-abc  ')).toBe(
      'AIzaSyExampleKey_1234567890-abc'
    );
  });

  it('rejects empty, malformed, or oversized API keys', () => {
    for (const value of ['', 'short', 'AIza key with spaces', `AIza${'x'.repeat(509)}`]) {
      expect(() => parseGeminiApiKey(value)).toThrow('Invalid Gemini API key');
    }
  });
});

describe('parseBrandingSettingsInput', () => {
  it('returns only safe branding fields', () => {
    expect(
      parseBrandingSettingsInput({
        company_name: ' NEO SUPPORT ',
        logo_url: 'https://example.invalid/logo.png',
        active_threshold_minutes: 10,
        gemini_api_key: 'must-not-pass-through',
      })
    ).toEqual({
      company_name: 'NEO SUPPORT',
      logo_url: 'https://example.invalid/logo.png',
      active_threshold_minutes: 10,
    });
  });

  it('rejects invalid branding settings', () => {
    expect(() => parseBrandingSettingsInput({ company_name: '', active_threshold_minutes: 10 })).toThrow(
      'Invalid company name'
    );
    expect(() =>
      parseBrandingSettingsInput({ company_name: 'NEO', active_threshold_minutes: 60 })
    ).toThrow('Invalid active threshold');
  });
});

describe('parseGoogleSheetsUrl', () => {
  it('accepts a deployed Google Apps Script web app URL', () => {
    expect(
      parseGoogleSheetsUrl('https://script.google.com/macros/s/abcDEF_123456/exec')
    ).toBe('https://script.google.com/macros/s/abcDEF_123456/exec');
  });

  it('allows an empty value to disconnect the integration', () => {
    expect(parseGoogleSheetsUrl('   ')).toBeNull();
  });

  it('rejects arbitrary, insecure, or credential-bearing URLs', () => {
    for (const value of [
      'http://script.google.com/macros/s/abcDEF_123456/exec',
      'https://example.com/macros/s/abcDEF_123456/exec',
      'https://user:pass@script.google.com/macros/s/abcDEF_123456/exec',
      'https://script.google.com/macros/s/abcDEF_123456/dev',
    ]) {
      expect(() => parseGoogleSheetsUrl(value)).toThrow('Invalid Google Apps Script URL');
    }
  });
});
