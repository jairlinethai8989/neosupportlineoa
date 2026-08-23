import { describe, expect, it } from 'vitest';
import { parsePortalTicketInput } from './portalTicketInput';

describe('Portal ticket input', () => {
  it('normalizes a valid customer ticket request', () => {
    expect(
      parsePortalTicketInput({
        subject: '  Printer error  ',
        description: '  The ward printer is offline.  ',
      })
    ).toEqual({
      subject: 'Printer error',
      description: 'The ward printer is offline.',
    });
  });

  it('rejects an empty subject or description', () => {
    expect(() =>
      parsePortalTicketInput({ subject: '   ', description: 'Details' })
    ).toThrow('Invalid ticket request');

    expect(() =>
      parsePortalTicketInput({ subject: 'Printer', description: '   ' })
    ).toThrow('Invalid ticket request');
  });

  it('rejects oversized customer-controlled text', () => {
    expect(() =>
      parsePortalTicketInput({ subject: 'S'.repeat(201), description: 'Details' })
    ).toThrow('Invalid ticket request');

    expect(() =>
      parsePortalTicketInput({ subject: 'Printer', description: 'D'.repeat(10_001) })
    ).toThrow('Invalid ticket request');
  });
});
