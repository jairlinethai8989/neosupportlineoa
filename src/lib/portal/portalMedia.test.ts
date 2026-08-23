import { describe, expect, it } from 'vitest';
import { createPortalMediaPath, parsePortalMediaInput } from './portalMedia';

describe('parsePortalMediaInput', () => {
  it('accepts an allowlisted image and normalizes its extension', () => {
    expect(parsePortalMediaInput({ name: 'Evidence FINAL.JPG', type: 'image/jpeg', size: 42 })).toEqual({
      extension: 'jpg',
      messageType: 'image',
      contentType: 'image/jpeg',
      size: 42,
    });
  });

  it('rejects executable and oversized attachments', () => {
    expect(() => parsePortalMediaInput({ name: 'payload.exe', type: 'application/octet-stream', size: 1 })).toThrow('Unsupported attachment type');
    expect(() => parsePortalMediaInput({ name: 'large.pdf', type: 'application/pdf', size: 15 * 1024 * 1024 + 1 })).toThrow('Attachment is too large');
  });
});

describe('createPortalMediaPath', () => {
  it('keeps every upload inside the owning ticket prefix', () => {
    const path = createPortalMediaPath('ticket-123', 'jpg', 'fixed-id');
    expect(path).toBe('portal/ticket-123/fixed-id.jpg');
  });
});
