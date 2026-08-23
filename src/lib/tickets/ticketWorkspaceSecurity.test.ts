import { describe, expect, it } from 'vitest';
import { parseTicketWorkspaceId, parseTicketWorkspaceListInput } from './ticketWorkspaceSecurity';

describe('ticket workspace query security', () => {
  it('normalizes a valid query', () => {
    expect(parseTicketWorkspaceListInput({
      fromIso: '2026-08-01T00:00:00+07:00',
      toIso: '2026-08-23T23:59:59+07:00',
      limit: 51,
      page: 2,
      searchTerm: ' แจ้ง error #42 ',
      sortKey: 'organization',
      sortDirection: 'asc',
    })).toMatchObject({ limit: 51, page: 2, searchTerm: 'แจ้ง error #42', sortKey: 'organization' });
  });

  it('rejects PostgREST filter syntax and unknown sort columns', () => {
    const base = { fromIso: '2026-08-01', toIso: '2026-08-23' };
    expect(() => parseTicketWorkspaceListInput({ ...base, searchTerm: 'x),status.eq.Closed' })).toThrow();
    expect(() => parseTicketWorkspaceListInput({ ...base, sortKey: 'private_column' })).toThrow();
  });

  it('accepts only UUID resource ids', () => {
    expect(parseTicketWorkspaceId('f4f20a4d-46ce-4e96-88a8-8050740dca5d')).toContain('f4f20a4d');
    expect(() => parseTicketWorkspaceId('not-an-id')).toThrow();
  });
});
