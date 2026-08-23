import { describe, expect, it } from 'vitest';
import { parseInboxAttachmentReference } from './inboxMediaSecurity';

describe('parseInboxAttachmentReference', () => {
  it('accepts an attachment scoped to the authenticated staff and conversation', () => {
    const staffId = '8a000000-0000-0000-0000-000000000001';
    const conversationId = '8a000000-0000-0000-0000-000000000002';
    const path = `staff/${staffId}/conversations/${conversationId}/8a000000-0000-0000-0000-000000000003.mp4`;
    expect(parseInboxAttachmentReference(path, staffId, conversationId)).toBe(path);
  });

  it('rejects another staff or conversation scope', () => {
    const path = 'staff/8a000000-0000-0000-0000-000000000099/conversations/8a000000-0000-0000-0000-000000000002/8a000000-0000-0000-0000-000000000003.pdf';
    expect(() => parseInboxAttachmentReference(path,
      '8a000000-0000-0000-0000-000000000001',
      '8a000000-0000-0000-0000-000000000002')).toThrow('Invalid inbox attachment');
  });
});
