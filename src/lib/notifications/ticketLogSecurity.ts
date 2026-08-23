export function getTicketLogVisibilityFilter(role: string, userId: string) {
  if (role === 'Administrator') return null;
  return `to_user_id.eq.${userId},performer_id.eq.${userId}`;
}
