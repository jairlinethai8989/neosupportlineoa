import { describe, expect, it } from 'vitest';
import {
  parseTicketDetailAttachmentReference,
  parseTicketDetailFieldUpdate,
  parseTicketDetailMessage,
} from './ticketDetailSecurity';

describe('ticket detail input security', () => {
  it('normalizes allowlisted field updates', () => {
    expect(parseTicketDetailFieldUpdate('priority', 'High')).toEqual({ field: 'priority', value: 'High' });
    expect(parseTicketDetailFieldUpdate('department', '87000000-0000-0000-0000-000000000001')).toEqual({
      field: 'current_department_id', value: '87000000-0000-0000-0000-000000000001',
    });
    expect(parseTicketDetailFieldUpdate('module', '  Pharmacy  ')).toEqual({ field: 'module', value: 'Pharmacy' });
  });

  it('rejects arbitrary fields and invalid values', () => {
    expect(() => parseTicketDetailFieldUpdate('assigned_agent_id', 'someone')).toThrow('Invalid ticket field update');
    expect(() => parseTicketDetailFieldUpdate('priority', 'Urgent')).toThrow('Invalid ticket field update');
    expect(() => parseTicketDetailFieldUpdate('department', 'bad')).toThrow('Invalid ticket field update');
  });

  it('normalizes a bounded message without trusting the actor', () => {
    expect(parseTicketDetailMessage({
      conversationId: '87000000-0000-0000-0000-000000000002', content: '  hello  ',
    })).toEqual({
      conversationId: '87000000-0000-0000-0000-000000000002', content: 'hello',
    });
    expect(() => parseTicketDetailMessage({ content: '' })).toThrow('Invalid ticket message');
    expect(() => parseTicketDetailMessage({ content: 'x'.repeat(10_001) })).toThrow('Invalid ticket message');
  });

  it('accepts only attachment paths scoped to the actor and ticket', () => {
    const path = 'staff/87000000-0000-0000-0000-000000000003/tickets/87000000-0000-0000-0000-000000000004/88000000-0000-0000-0000-000000000001.webp';
    expect(parseTicketDetailAttachmentReference({ path, conversationId: null },
      '87000000-0000-0000-0000-000000000003', '87000000-0000-0000-0000-000000000004')).toEqual({ path, conversationId: null });
    expect(() => parseTicketDetailAttachmentReference({ path, conversationId: null },
      '87000000-0000-0000-0000-000000000099', '87000000-0000-0000-0000-000000000004')).toThrow('Invalid ticket attachment');
  });
});
