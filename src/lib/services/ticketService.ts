import { 
  claimTicketServerAction, 
  updateTicketStatusAction, 
  transferTicketAction, 
  resolveTicketAction,
  reviewFixCompletedAction,
} from '@/app/actions/ticketActions';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(name: string, value: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
}

function assertOptionalUuid(name: string, value?: string) {
  if (value == null || value === '') return;
  assertUuid(name, value);
}

function assertNonEmpty(name: string, value?: string) {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required`);
  }
}

/**
 * 🚨 SECURITY UPGRADE (v2.0):
 * This service now acts as a secure Server Action proxy.
 * It intentionally ignores all `agentId` parameters passed from the browser client,
 * delegating the execution to `ticketActions.ts` which uses the trusted 
 * server-side HttpOnly session cookie to authenticate the performer.
 */
export const ticketService = {
  async claimTicket(ticketId: string, agentId?: string) {
    assertUuid('ticketId', ticketId);
    assertOptionalUuid('agentId', agentId);
    return claimTicketServerAction(ticketId);
  },

  async updateStatus(ticketId: string, newStatus: string, agentId?: string, note?: string, escalationToken?: string) {
    assertUuid('ticketId', ticketId);
    assertOptionalUuid('agentId', agentId);
    assertNonEmpty('newStatus', newStatus);
    return updateTicketStatusAction(ticketId, newStatus, note, escalationToken);
  },

  async transfer(ticketId: string, fromAgentId?: string, toAgentId?: string, toTeamId?: string, reason?: string) {
    assertUuid('ticketId', ticketId);
    assertOptionalUuid('fromAgentId', fromAgentId);
    assertOptionalUuid('toAgentId', toAgentId);
    assertOptionalUuid('toTeamId', toTeamId);
    return transferTicketAction(ticketId, toAgentId, toTeamId, reason);
  },

  async resolve(ticketId: string, agentId?: string, resolutionSummary?: string, module?: string, issueType?: string, conversationId?: string) {
    assertUuid('ticketId', ticketId);
    assertOptionalUuid('agentId', agentId);
    assertOptionalUuid('conversationId', conversationId);
    return resolveTicketAction(ticketId, resolutionSummary || '', module, issueType, conversationId);
  },

  async reviewFixCompleted(ticketId: string, decision: 'accept' | 'reject', note?: string) {
    assertUuid('ticketId', ticketId);
    return reviewFixCompletedAction(ticketId, decision, note);
  }
};
