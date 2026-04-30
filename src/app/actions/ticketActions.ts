'use server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { invalidateAllLiveCaches } from '@/lib/cache/liveCache';
import { invalidateAllPreviewCaches } from '@/lib/reports/previewCache';

type TicketUpdatePayload = Record<string, string | null>;

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

async function verifyAgentRole(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile || !['Agent', 'Administrator'].includes(profile.role)) {
    throw new Error('Unauthorized: Agent role required');
  }
  return profile.role;
}

export async function claimTicketServerAction(ticketId: string) {
  const user = await getSessionUser();
  await verifyAgentRole(user.id);
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
     // 1. Check if this ticket already has an active conversation
     const { data: existingConv } = await supabaseAdmin
       .from('conversations')
       .select('id')
       .eq('current_ticket_id', ticketId)
       .eq('status', 'active')
       .maybeSingle();

     if (!existingConv) {
       // 2. Create a new conversation for this ticket if it doesn't exist
       // This supports the "1 Ticket : 1 Chat" architecture
       await supabaseAdmin.from('conversations').insert([{
         customer_id: ticket.customer_id,
         current_ticket_id: ticketId,
         status: 'active',
         last_message_at: new Date().toISOString()
       }]);
     }
  }

  await supabaseAdmin.from('ticket_logs').insert([{
    ticket_id: ticketId,
    action_type: 'claim',
    to_status: 'In Progress',
    performer_id: agentId,
    note: 'Agent claimed the ticket securely via server action'
  }]);

  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
  return ticket;
}

export async function updateTicketStatusAction(ticketId: string, newStatus: string, note?: string, escalationToken?: string) {
  const user = await getSessionUser();
  await verifyAgentRole(user.id);
  const agentId = user.id;

  const { data: currentTicket } = await supabaseAdmin
    .from('tickets')
    .select('status')
    .eq('id', ticketId)
    .single();

  const updateData: TicketUpdatePayload = { 
    status: newStatus,
    updated_at: new Date().toISOString()
  };
  if (escalationToken) {
    updateData.escalation_token = escalationToken;
  }

  const { data: ticket, error: updateError } = await supabaseAdmin
    .from('tickets')
    .update(updateData)
    .eq('id', ticketId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  // v3.0: Automatically close active conversations if ticket is Resolved, Escalated or Pending
  if (['Resolved', 'Escalated', 'Pending'].includes(newStatus)) {
    await supabaseAdmin
      .from('conversations')
      .update({ 
        status: 'closed',
        current_ticket_id: null 
      })
      .eq('current_ticket_id', ticketId)
      .eq('status', 'active');
  }

  await supabaseAdmin.from('ticket_logs').insert([{
    ticket_id: ticketId,
    action_type: 'status_change',
    from_status: currentTicket?.status,
    to_status: newStatus,
    performer_id: agentId,
    note: note || `Status changed to ${newStatus}`
  }]);

  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
  return ticket;
}

export async function transferTicketAction(ticketId: string, toAgentId?: string, toTeamId?: string, reason?: string) {
   const user = await getSessionUser();
   await verifyAgentRole(user.id);
   const fromAgentId = user.id;

   const updateData: TicketUpdatePayload = { 
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

   // v3.1: Close active conversations on transfer (since status becomes Escalated)
   await supabaseAdmin
     .from('conversations')
     .update({ 
       status: 'closed',
       current_ticket_id: null 
     })
     .eq('current_ticket_id', ticketId)
     .eq('status', 'active');

   invalidateAllLiveCaches();
   invalidateAllPreviewCaches();
   return ticket;
}

export async function resolveTicketAction(
   ticketId: string, 
   resolutionSummary: string, 
   module?: string, 
   issueType?: string,
   conversationId?: string,
   surveyLink?: string
) {
   const user = await getSessionUser();
   const agentId = user.id;

   const updateData: TicketUpdatePayload = { 
     status: 'Resolved',
     resolved_at: new Date().toISOString(),
     resolution_summary: resolutionSummary,
     updated_at: new Date().toISOString()
   };

   if (module) updateData.module = module;
   if (issueType) updateData.issue_type = issueType;

   const { data: ticket, error: resolveError } = await supabaseAdmin
     .from('tickets')
     .update(updateData)
     .eq('id', ticketId)
     .select()
     .single();

   if (resolveError) {
     console.error('[ResolveAction] DB Update Error:', resolveError);
     throw new Error(resolveError.message);
   }

   try {
     // Record Log
     await supabaseAdmin.from('ticket_logs').insert([{
       ticket_id: ticketId,
       action_type: 'resolve',
       to_status: 'Resolved',
       performer_id: agentId,
       note: resolutionSummary
     }]);

     // Only handle CSAT and Conversations if there is a customer linked
     if (ticket?.customer_id) {
        // 1. Send CSAT Survey (Silent fail - don't block resolution)
        try {
          await supabaseAdmin.from('csat_surveys').upsert({
             ticket_id: ticketId,
             sent_at: new Date().toISOString()
          }, { onConflict: 'ticket_id' });
        } catch (csatErr) {
          console.error('[ResolveAction] Silent CSAT Error:', csatErr);
        }

        // 2. Close only the conversation that belongs to this ticket resolution.
        // Never close every active conversation of the same customer.
        if (conversationId) {
          await supabaseAdmin
            .from('conversations')
            .update({
              status: 'closed',
              current_ticket_id: null,
            })
            .eq('id', conversationId)
            .eq('status', 'active');
        } else {
          await supabaseAdmin
            .from('conversations')
            .update({
              status: 'closed',
              current_ticket_id: null,
            })
            .eq('current_ticket_id', ticketId)
            .eq('status', 'active');
        }
     }

     // 3. Send system message if requested (Atomic)
     if (conversationId) {
        const content = `[SYSTEM] ✅ งานได้รับการแก้ไขแล้ว: ${resolutionSummary}\nโมดูล: ${module || 'N/A'}\n\n👉 ทำประเมินที่นี่: ${surveyLink || 'N/A'}`;
        await supabaseAdmin.from('messages').insert([{
           conversation_id: conversationId,
           ticket_id: ticketId,
           sender_type: 'system',
           content: content,
           staff_id: agentId,
           message_type: 'text'
        }]);
     }
   } catch (postError) {
     // Even if logs/CSAT/conv fails, we already updated the ticket status.
     // We log it but don't necessarily crash the whole resolve action.
     console.error('[ResolveAction] Post-update processing error:', postError);
   }

   invalidateAllLiveCaches();
   invalidateAllPreviewCaches();
   return ticket;
}
