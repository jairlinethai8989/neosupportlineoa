import { describe, expect, it } from 'vitest';
import type { InboxConversation } from '@/types/inbox';
import { isConversationActiveLike, sortConversations, upsertConversation } from './useRealtimeInbox';

function makeConversation(
  overrides: Partial<InboxConversation> = {}
): InboxConversation {
  return {
    id: overrides.id ?? 'conv-1',
    customer_id: overrides.customer_id ?? 'cust-1',
    title: overrides.title ?? 'Test',
    status: overrides.status ?? 'active',
    current_ticket_id: overrides.current_ticket_id ?? null,
    created_at: overrides.created_at ?? new Date(0).toISOString(),
    updated_at: overrides.updated_at ?? new Date(0).toISOString(),
    is_active: overrides.is_active ?? true,
    last_message_at: overrides.last_message_at ?? new Date(0).toISOString(),
    customers: overrides.customers ?? null,
    tickets: overrides.tickets ?? null,
  };
}

describe('useRealtimeInbox helpers', () => {
  it('detects active-like conversations by status', () => {
    expect(isConversationActiveLike(makeConversation({ status: 'in_progress', is_active: false }))).toBe(true);
    expect(isConversationActiveLike(makeConversation({ status: 'closed', is_active: false }))).toBe(false);
  });

  it('sorts by last_message_at desc', () => {
    const items = [
      makeConversation({ id: 'a', last_message_at: '2026-01-01T00:00:00.000Z' }),
      makeConversation({ id: 'b', last_message_at: '2026-01-02T00:00:00.000Z' }),
    ];
    expect(sortConversations(items).map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('upserts and caps max items', () => {
    const current = [
      makeConversation({ id: 'a', last_message_at: '2026-01-01T00:00:00.000Z' }),
      makeConversation({ id: 'b', last_message_at: '2026-01-02T00:00:00.000Z' }),
    ];
    const updated = makeConversation({ id: 'a', last_message_at: '2026-01-03T00:00:00.000Z' });

    const result = upsertConversation(current, updated, 2);
    expect(result.map((item) => item.id)).toEqual(['a', 'b']);
  });
});
