import { describe, expect, it } from 'vitest';
import {
  parseInboxConversationListInput,
  parseInboxMessagePageInput,
  parseInboxReadId,
} from './inboxReadSecurity';

describe('inbox read security', () => {
  const id = 'f4f20a4d-46ce-4e96-88a8-8050740dca5d';

  it('validates cursor pagination as a pair', () => {
    expect(parseInboxConversationListInput({
      status: 'active', pageSize: 20, cursorLastMessageAt: '2026-08-23T10:00:00Z', cursorId: id,
    })).toMatchObject({ status: 'active', pageSize: 20, cursorId: id });
    expect(() => parseInboxConversationListInput({ cursorId: id })).toThrow();
  });

  it('validates message paging inputs', () => {
    expect(parseInboxMessagePageInput({ conversationId: id, limit: 50 })).toMatchObject({
      conversationId: id, limit: 50,
    });
    expect(() => parseInboxMessagePageInput({ conversationId: id, limit: 1000 })).toThrow();
  });

  it('rejects non-UUID ids', () => {
    expect(() => parseInboxReadId('all', 'conversation id')).toThrow();
  });
});
