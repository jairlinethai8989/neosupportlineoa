const UNSAFE_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function sanitizeExternalAiContextText(value: unknown, maxLength: number) {
  if (typeof value !== 'string' || !Number.isInteger(maxLength) || maxLength < 1) return '-';
  const normalized = value.replace(UNSAFE_CONTROL_PATTERN, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : '-';
}

export function parseConfiguredAiEndpoint(value: string | undefined) {
  if (!value || !value.trim()) return null;
  const normalized = value.trim();
  if (normalized.length > 2048) throw new TypeError('Invalid AI endpoint');

  let endpoint: URL;
  try {
    endpoint = new URL(normalized);
  } catch {
    throw new TypeError('Invalid AI endpoint');
  }

  if (
    (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash ||
    !endpoint.hostname
  ) {
    throw new TypeError('Invalid AI endpoint');
  }

  return endpoint.toString();
}

export async function readBoundedJsonResponse(response: Response, maxBytes = 1_000_000): Promise<unknown> {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 10_000_000) {
    throw new TypeError('Invalid AI response limit');
  }

  const declaredLength = response.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    throw new TypeError('AI response is too large');
  }
  if (!response.body) throw new TypeError('AI response body is missing');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let totalBytes = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new TypeError('AI response is too large');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new TypeError('AI response is not valid JSON');
  }
}

export function extractGeminiCandidateText(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const candidates = (input as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return null;
  const first = candidates[0];
  if (!first || typeof first !== 'object' || Array.isArray(first)) return null;
  const content = (first as { content?: unknown }).content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return null;
  const part = parts[0];
  if (!part || typeof part !== 'object' || Array.isArray(part)) return null;
  const text = (part as { text?: unknown }).text;
  return typeof text === 'string' ? text : null;
}

export function extractRagMessageText(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const response = input as { choices?: unknown; message?: unknown };
  if (Array.isArray(response.choices)) {
    const first = response.choices[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const message = (first as { message?: unknown }).message;
      if (message && typeof message === 'object' && !Array.isArray(message)) {
        const content = (message as { content?: unknown }).content;
        if (typeof content === 'string') return content;
      }
    }
  }
  if (response.message && typeof response.message === 'object' && !Array.isArray(response.message)) {
    const content = (response.message as { content?: unknown }).content;
    if (typeof content === 'string') return content;
  }
  return null;
}
