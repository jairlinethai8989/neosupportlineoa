export interface PortalTicketInput {
  subject: string;
  description: string;
}

export function parsePortalTicketInput(input: PortalTicketInput): PortalTicketInput {
  const parsed = {
    subject: input.subject.trim(),
    description: input.description.trim(),
  };

  if (
    !parsed.subject ||
    !parsed.description ||
    parsed.subject.length > 200 ||
    parsed.description.length > 10_000
  ) {
    throw new Error('Invalid ticket request');
  }

  return parsed;
}
