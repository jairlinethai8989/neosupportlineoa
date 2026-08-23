import { describe, expect, it } from 'vitest';
import {
  extractGeminiCandidateText,
  extractRagMessageText,
  parseConfiguredAiEndpoint,
  readBoundedJsonResponse,
  sanitizeExternalAiContextText,
} from './externalAiSecurity';

describe('parseConfiguredAiEndpoint', () => {
  it('accepts bounded HTTP(S) endpoints without embedded credentials', () => {
    expect(parseConfiguredAiEndpoint(undefined)).toBeNull();
    expect(parseConfiguredAiEndpoint('https://rag.example.test/api/chat')).toBe(
      'https://rag.example.test/api/chat'
    );
    expect(parseConfiguredAiEndpoint('http://127.0.0.1:11434/api/chat')).toBe(
      'http://127.0.0.1:11434/api/chat'
    );

    expect(() => parseConfiguredAiEndpoint('file:///etc/passwd')).toThrow(TypeError);
    expect(() => parseConfiguredAiEndpoint('https://user:pass@rag.example.test/api')).toThrow(TypeError);
    expect(() => parseConfiguredAiEndpoint('https://rag.example.test/api#secret')).toThrow(TypeError);
    expect(() => parseConfiguredAiEndpoint(`https://rag.example.test/${'x'.repeat(2049)}`)).toThrow(TypeError);
  });
});

describe('readBoundedJsonResponse', () => {
  it('parses JSON only while the provider response stays within the byte limit', async () => {
    await expect(readBoundedJsonResponse(new Response('{"ok":true}'), 100)).resolves.toEqual({ ok: true });
    await expect(readBoundedJsonResponse(new Response(`{"text":"${'x'.repeat(101)}"}`), 100)).rejects.toThrow(
      TypeError
    );
    await expect(
      readBoundedJsonResponse(new Response('{}', { headers: { 'content-length': '1000' } }), 100)
    ).rejects.toThrow(TypeError);
  });
});

describe('external AI response envelopes', () => {
  it('extracts only the documented provider text fields', () => {
    expect(extractGeminiCandidateText({
      candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
    })).toBe('{"ok":true}');
    expect(extractRagMessageText({ choices: [{ message: { content: '{"ok":true}' } }] })).toBe(
      '{"ok":true}'
    );
    expect(extractRagMessageText({ message: { content: '{"ok":true}' } })).toBe('{"ok":true}');
    expect(extractGeminiCandidateText({ candidates: [{ content: { parts: [{ text: 123 }] } }] })).toBeNull();
    expect(extractRagMessageText({ choices: 'invalid' })).toBeNull();
  });
});

describe('sanitizeExternalAiContextText', () => {
  it('removes unsafe controls and bounds untrusted prompt context', () => {
    const value = sanitizeExternalAiContextText(`note\u0000${'x'.repeat(2000)}`, 1000);
    expect(value).not.toContain('\u0000');
    expect(value.length).toBe(1000);
    expect(sanitizeExternalAiContextText(null, 1000)).toBe('-');
  });
});
