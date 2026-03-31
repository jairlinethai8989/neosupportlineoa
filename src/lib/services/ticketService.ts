/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';

export const ticketService = {
  /**
   * Claim a ticket for the current agent
   */
  async claimTicket(ticketId: string, agentId: string) {
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .update({ 
        assigned_agent_id: agentId, 
        status: 'Assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (ticketError) throw ticketError;

    // Log the action
    await supabase.from('ticket_logs').insert([{
      ticket_id: ticketId,
      action_type: 'claim',
      to_status: 'Assigned',
      performer_id: agentId,
      note: 'Agent claimed the ticket'
    }]);

    return ticket;
  },

  /**
   * Update ticket status with logging
   */
  async updateStatus(ticketId: string, newStatus: string, agentId: string, note?: string) {
    const { data: currentTicket } = await supabase
      .from('tickets')
      .select('status')
      .eq('id', ticketId)
      .single();

    const { data: ticket, error: updateError } = await supabase
      .from('tickets')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log the action
    await supabase.from('ticket_logs').insert([{
      ticket_id: ticketId,
      action_type: 'status_change',
      from_status: currentTicket?.status,
      to_status: newStatus,
      performer_id: agentId,
      note: note || `Status changed to ${newStatus}`
    }]);

    return ticket;
  },

  /**
   * Transfer ticket to another agent or team
   */
  async transfer(ticketId: string, fromAgentId: string, toAgentId?: string, toTeamId?: string, reason?: string) {
     const updateData: any = { 
       updated_at: new Date().toISOString(),
       status: 'Escalated' 
     };
     if (toAgentId) updateData.assigned_agent_id = toAgentId;
     if (toTeamId) updateData.assigned_team_id = toTeamId;

     const { data: ticket, error: transferError } = await supabase
       .from('tickets')
       .update(updateData)
       .eq('id', ticketId)
       .select()
       .single();

     if (transferError) throw transferError;

     // Log the transfer
     await supabase.from('ticket_logs').insert([{
       ticket_id: ticketId,
       action_type: 'transfer',
       to_status: 'Escalated',
       performer_id: fromAgentId,
       to_user_id: toAgentId,
       to_team_id: toTeamId,
       note: reason || 'Ticket transferred'
     }]);

     return ticket;
  },

  /**
   * Resolve a ticket and send CSAT trigger (placeholder)
   */
  async resolve(ticketId: string, agentId: string, resolutionSummary: string) {
     const { data: ticket, error: resolveError } = await supabase
       .from('tickets')
       .update({ 
         status: 'Resolved',
         resolved_at: new Date().toISOString(),
         resolution_summary: resolutionSummary,
         updated_at: new Date().toISOString()
       })
       .eq('id', ticketId)
       .select()
       .single();

     if (resolveError) throw resolveError;

     // Log the resolution
     await supabase.from('ticket_logs').insert([{
       ticket_id: ticketId,
       action_type: 'resolve',
       to_status: 'Resolved',
       performer_id: agentId,
       note: resolutionSummary
     }]);

     // Trigger CSAT survey record creation
     await supabase.from('csat_surveys').insert([{
        ticket_id: ticketId,
        sent_at: new Date().toISOString()
     }]);

     // TODO: Actually send LINE message via Messaging API here or via Edge Function
     
     return ticket;
  }
};
