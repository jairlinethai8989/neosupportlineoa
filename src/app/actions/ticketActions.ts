'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to authenticate session dynamically on server
async function getSessionUser() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
      },
    }
  );
  
  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) throw new Error('Unauthorized Access. Invalid Session.');
  return user;
}

export async function claimTicketServerAction(ticketId: string) {
  const user = await getSessionUser();
  const agentId = user.id;

  const { data: ticket, error: ticketError } = await supabaseAdmin
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

  if (ticketError) throw new Error(ticketError.message);

  if (ticket?.customer_id) {
     await supabaseAdmin.from('conversations')
      .update({ current_ticket_id: ticketId })
      .eq('customer_id', ticket.customer_id)
      .eq('status', 'active');
  }

  await supabaseAdmin.from('ticket_logs').insert([{
    ticket_id: ticketId,
    action_type: 'claim',
    to_status: 'In Progress',
    performer_id: agentId,
    note: 'Agent claimed the ticket securely via server action'
  }]);

  return ticket;
}

export async function updateTicketStatusAction(ticketId: string, newStatus: string, note?: string) {
  const user = await getSessionUser();
  const agentId = user.id;

  const { data: currentTicket } = await supabaseAdmin
    .from('tickets')
    .select('status')
    .eq('id', ticketId)
    .single();

  const { data: ticket, error: updateError } = await supabaseAdmin
    .from('tickets')
    .update({ 
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  await supabaseAdmin.from('ticket_logs').insert([{
    ticket_id: ticketId,
    action_type: 'status_change',
    from_status: currentTicket?.status,
    to_status: newStatus,
    performer_id: agentId,
    note: note || `Status changed to ${newStatus}`
  }]);

  return ticket;
}

export async function transferTicketAction(ticketId: string, toAgentId?: string, toTeamId?: string, reason?: string) {
   const user = await getSessionUser();
   const fromAgentId = user.id;

   const updateData: any = { 
     updated_at: new Date().toISOString(),
     status: 'Escalated' 
   };
   if (toAgentId) updateData.assigned_agent_id = toAgentId;
   if (toTeamId) updateData.assigned_team_id = toTeamId;

   const { data: ticket, error: transferError } = await supabaseAdmin
     .from('tickets')
     .update(updateData)
     .eq('id', ticketId)
     .select()
     .single();

   if (transferError) throw new Error(transferError.message);

   await supabaseAdmin.from('ticket_logs').insert([{
     ticket_id: ticketId,
     action_type: 'transfer',
     to_status: 'Escalated',
     performer_id: fromAgentId,
     to_user_id: toAgentId,
     to_team_id: toTeamId,
     note: reason || 'Ticket transferred securely'
   }]);

   return ticket;
}

export async function resolveTicketAction(ticketId: string, resolutionSummary: string) {
   const user = await getSessionUser();
   const agentId = user.id;

   const { data: ticket, error: resolveError } = await supabaseAdmin
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

   if (resolveError) throw new Error(resolveError.message);

   await supabaseAdmin.from('ticket_logs').insert([{
     ticket_id: ticketId,
     action_type: 'resolve',
     to_status: 'Resolved',
     performer_id: agentId,
     note: resolutionSummary
   }]);

   await supabaseAdmin.from('csat_surveys').insert([{
      ticket_id: ticketId,
      sent_at: new Date().toISOString()
   }]);

   if (ticket?.customer_id) {
      await supabaseAdmin.from('conversations')
       .update({ 
         status: 'closed',
         current_ticket_id: null
       })
       .eq('customer_id', ticket.customer_id)
       .eq('status', 'active');
   }

   return ticket;
}
