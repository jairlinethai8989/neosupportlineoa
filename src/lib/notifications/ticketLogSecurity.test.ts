import { describe, expect, it } from 'vitest';
import { getTicketLogVisibilityFilter } from './ticketLogSecurity';

describe('getTicketLogVisibilityFilter', () => {
  it('returns all rows only for administrators', () => {
    expect(getTicketLogVisibilityFilter('Administrator', '89000000-0000-0000-0000-000000000001')).toBeNull();
  });

  it('scopes agents to rows addressed to or performed by their server identity', () => {
    expect(getTicketLogVisibilityFilter('Agent', '89000000-0000-0000-0000-000000000001')).toBe(
      'to_user_id.eq.89000000-0000-0000-0000-000000000001,performer_id.eq.89000000-0000-0000-0000-000000000001'
    );
  });
});
