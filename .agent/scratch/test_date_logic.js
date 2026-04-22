function getTicketWorkspaceDateRange(timeRange, customStart, customEnd) {
  let from = null;
  let to = new Date();
  to.setHours(23, 59, 59, 999);

  if (timeRange === 'today') {
    from = new Date();
    from.setHours(0, 0, 0, 0);
  }

  return {
    fromIso: from ? from.toISOString() : '2000-01-01T00:00:00Z',
    toIso: to.toISOString(),
  };
}

function isTicketWithinWorkspaceRange(ticket, timeRange, customStart, customEnd) {
  if (!ticket.created_at) return false;

  const createdAtMs = new Date(ticket.created_at).getTime();
  if (Number.isNaN(createdAtMs)) return false;

  const { fromIso, toIso } = getTicketWorkspaceDateRange(timeRange, customStart, customEnd);
  console.log("ticket createdAt:", ticket.created_at);
  console.log("createdAtMs:", createdAtMs);
  console.log("fromIso:", fromIso);
  console.log("toIso", toIso);
  
  const fromMs = new Date(fromIso).getTime();
  const toMs = new Date(toIso).getTime();

  console.log("fromMs:", fromMs);
  console.log("toMs:", toMs);
  
  return createdAtMs >= fromMs && createdAtMs <= toMs;
}

const now = new Date();
const fakeTicket = { created_at: now.toISOString() };
console.log("Is within range:", isTicketWithinWorkspaceRange(fakeTicket, 'today', '', ''));
