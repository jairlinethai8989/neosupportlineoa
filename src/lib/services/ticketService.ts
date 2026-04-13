/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';

// Helper: tell the DB trigger to skip auto-logging (service will log manually)
async function skipAuditTrigger() {
  try {
    await (supabase as any).rpc('set_config', {
      setting: 'app.skip_audit_trigger',
      value: 'true',
      is_local: true
    });
  } catch {
    // Non-critical; suppress errors silently
  }
}

export const ticketService = {
  /**
   * Claim a ticket for the current agent
   */
  async claimTicket(ticketId: string, agentId: string) {
    await skipAuditTrigger();

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .update({ 
        assigned_agent_id: agentId, 
        status: 'In Progress',
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (ticketError) throw ticketError;

    // Link to Active Conversation for Inbox/Resolve functionality
    if (ticket?.customer_id) {
       await supabase.from('conversations')
        .update({ current_ticket_id: ticketId })
        .eq('customer_id', ticket.customer_id)
        .eq('status', 'active');
    }

    // Log the action
    await supabase.from('ticket_logs').insert([{
      ticket_id: ticketId,
      action_type: 'claim',
      to_status: 'In Progress',
      performer_id: agentId,
      note: 'Agent claimed the ticket'
    }]);

    // Send Group Notification (Non-blocking)
    try {
      const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
      const { data: agent } = await supabase.from('profiles').select('full_name').eq('id', agentId).single();
      await sendLineGroupNotification(`👷‍♂️ [รับงานแล้ว] แอดมิน ${agent?.full_name || 'Anonymous'} ได้รับตั๋วงาน #${ticket.ticket_no} เรียบร้อยแล้วครับ`);
    } catch (notifyError) {
      console.warn('Line Notification Failed:', notifyError);
    }

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

    await skipAuditTrigger();

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

     await skipAuditTrigger();

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

     // Send Group Notification (Non-blocking)
     try {
       const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
       const { data: agent } = await supabase.from('profiles').select('full_name').eq('id', fromAgentId).single();
       let transferTarget = 'Team/Agent';
       if (toAgentId) {
          const { data: ta } = await supabase.from('profiles').select('full_name').eq('id', toAgentId).single();
          transferTarget = ta?.full_name || transferTarget;
       }
       await sendLineGroupNotification(`🔄 [โอนงาน] แอดมิน ${agent?.full_name || 'Anonymous'} ได้โอนตั๋วงาน #${ticket.ticket_no} ให้กับ ${transferTarget} เรียบร้อยแล้ว\nหมายเหตุ: ${reason || '-'}`);
     } catch (notifyErr) {
       console.warn('Transfer Notification Failed:', notifyErr);
     }

     return ticket;
  },

  /**
   * Resolve a ticket and send CSAT trigger
   */
  async resolve(ticketId: string, agentId: string, resolutionSummary: string) {
     await skipAuditTrigger();

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

     // Send Group Notification
     const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
     const { data: agent } = await supabase.from('profiles').select('full_name').eq('id', agentId).single();
     await sendLineGroupNotification(`✅ [ปิดงาน] แอดมิน ${agent?.full_name || 'Anonymous'} ได้แก้ไขและปิดตั๋วงาน #${ticket.ticket_no} สำเร็จแล้วครับ\nสรุปงาน: ${resolutionSummary}`);

     // Trigger CSAT survey record creation
     await supabase.from('csat_surveys').insert([{
        ticket_id: ticketId,
        sent_at: new Date().toISOString()
     }]);

     // Close the active conversation to ensure a new ticket starts a fresh session
     if (ticket?.customer_id) {
        await supabase.from('conversations')
         .update({ 
           status: 'closed',
           current_ticket_id: null
         })
         .eq('customer_id', ticket.customer_id)
         .eq('status', 'active');
     }

     return ticket;
  }
};
