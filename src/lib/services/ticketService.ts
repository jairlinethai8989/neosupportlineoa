import { 
  claimTicketServerAction, 
  updateTicketStatusAction, 
  transferTicketAction, 
  resolveTicketAction 
} from '@/app/actions/ticketActions';

/**
 * 🚨 SECURITY UPGRADE (v2.0):
 * This service now acts as a secure Server Action proxy.
 * It intentionally ignores all `agentId` parameters passed from the browser client,
 * delegating the execution to `ticketActions.ts` which uses the trusted 
 * server-side HttpOnly session cookie to authenticate the performer.
 */
export const ticketService = {
  async claimTicket(ticketId: string, agentId?: string) {
    return claimTicketServerAction(ticketId);
  },

  async updateStatus(ticketId: string, newStatus: string, agentId?: string, note?: string) {
    return updateTicketStatusAction(ticketId, newStatus, note);
  },

  async transfer(ticketId: string, fromAgentId?: string, toAgentId?: string, toTeamId?: string, reason?: string) {
    return transferTicketAction(ticketId, toAgentId, toTeamId, reason);
  },

  async resolve(ticketId: string, agentId?: string, resolutionSummary?: string, module?: string) {
    return resolveTicketAction(ticketId, resolutionSummary || '', module);
  }
};
