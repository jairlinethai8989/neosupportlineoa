const TICKET_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createPortalSurveyPath(ticketId: string) {
  const normalizedTicketId = String(ticketId || '').trim();
  if (!TICKET_UUID_PATTERN.test(normalizedTicketId)) return '/portal';

  return `/portal?survey_ticket_id=${encodeURIComponent(normalizedTicketId)}`;
}
