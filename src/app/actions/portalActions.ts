'use server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyStaffGroupIfConfigured } from '@/lib/utils/lineNotifications';
import { verifyLiffIdentity } from '@/lib/auth/verifyLiffToken';
import { calculateSlaDeadline } from '@/lib/utils/slaUtils';
import { invalidateAllLiveCaches } from '@/lib/cache/liveCache';
import { invalidateAllPreviewCaches } from '@/lib/reports/previewCache';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://neoworkspace.vercel.app').replace(/\/$/, '');

/**
 * Securely creates a new support ticket from the Customer Portal.
 * Verifies LINE LIFF ID token server-side, calculates SLA, creates ticket/conversation/messages,
 * and pushes a notification to the internal LINE staff group if configured.
 */
export async function createPortalTicketAction(input: {
  lineUserId?: string | null;
  idToken?: string | null;
  subject: string;
  description: string;
  attachmentUrl?: string | null;
}) {
  const subject = input.subject?.trim();
  const description = input.description?.trim();
  if (!subject) throw new Error('กรุณาเลือกหัวข้อปัญหา');
  if (!description) throw new Error('กรุณาระบุรายละเอียดเพิ่มเติม');

  const identity = await verifyLiffIdentity({
    lineUserId: input.lineUserId,
    idToken: input.idToken,
  });

  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('id, display_name, organization_id, department_id, organizations(name, abbreviation)')
    .eq('line_user_id', identity.lineUserId)
    .maybeSingle();

  if (customerError || !customer) {
    throw new Error('ไม่พบข้อมูลลูกค้าในระบบ กรุณาลงทะเบียนก่อนใช้งาน');
  }
  if (!customer.organization_id) {
    throw new Error('กรุณาลงทะเบียนหน่วยงานก่อนเปิดใบงาน');
  }

  const orgRel = Array.isArray(customer.organizations)
    ? customer.organizations[0]
    : customer.organizations;
  const hospitalAbbr = (orgRel as { abbreviation?: string | null } | null)?.abbreviation || 'NEO';
  const orgName = (orgRel as { name?: string | null } | null)?.name || 'ไม่ระบุหน่วยงาน';

  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ticketNo = `${hospitalAbbr}-${dateStr}-${randomSuffix}`;

  let slaDueAt: string | null = null;
  try {
    const { data: slaRule } = await supabaseAdmin
      .from('sla_rules')
      .select('response_time_minutes, resolution_time_minutes')
      .eq('priority', 'Medium')
      .maybeSingle();

    if (slaRule) {
      const duration = slaRule.resolution_time_minutes || slaRule.response_time_minutes || 60;
      slaDueAt = calculateSlaDeadline(now, duration).toISOString();
    }
  } catch (slaErr) {
    console.warn('Portal create SLA calculation skipped:', slaErr);
  }

  const { data: createdTicket, error: ticketError } = await supabaseAdmin
    .from('tickets')
    .insert([{
      ticket_no: ticketNo,
      customer_id: customer.id,
      organization_id: customer.organization_id,
      current_department_id: customer.department_id,
      subject,
      description,
      status: 'New',
      priority: 'Medium',
      created_at: now.toISOString(),
      sla_due_at: slaDueAt,
    }])
    .select()
    .single();

  if (ticketError || !createdTicket) {
    throw new Error(`Ticket Creation Failed: ${ticketError?.message || 'Unknown error'}`);
  }

  const { data: newConv } = await supabaseAdmin
    .from('conversations')
    .insert([{
      customer_id: customer.id,
      status: 'active',
      current_ticket_id: createdTicket.id,
      last_message_at: now.toISOString(),
    }])
    .select('id')
    .single();

  const conversationId = newConv?.id || null;

  if (conversationId) {
    if (input.attachmentUrl) {
      await supabaseAdmin.from('messages').insert([{
        ticket_id: createdTicket.id,
        conversation_id: conversationId,
        sender_type: 'customer',
        customer_id: customer.id,
        message_type: 'image',
        content: input.attachmentUrl,
      }]);
    }

    await supabaseAdmin.from('messages').insert([{
      ticket_id: createdTicket.id,
      conversation_id: conversationId,
      sender_type: 'customer',
      customer_id: customer.id,
      message_type: 'text',
      content: description,
    }]);
  }

  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();

  // Notify internal LINE staff group (non-blocking)
  const preview = description.length > 140 ? `${description.slice(0, 140)}...` : description;
  void notifyStaffGroupIfConfigured(
    `🆕 ใบงานใหม่ #${ticketNo}\n` +
    `หน่วยงาน: ${orgName}\n` +
    `ผู้แจ้ง: ${customer.display_name || 'ลูกค้า'}\n` +
    `หัวข้อ: ${subject}\n` +
    `รายละเอียด: ${preview}\n` +
    `เปิดดู: ${APP_BASE_URL}/tickets/${createdTicket.id}`
  );

  return { ticket: createdTicket };
}

/**
 * Securely sends a message from the Portal (Customer side).
 * Verifies LINE LIFF ID token and ticket ownership before inserting.
 * After successful insert, pushes a LINE notification to the internal staff group.
 */
export async function sendPortalMessageAction(
  ticketId: string,
  lineUserId: string,
  content: string,
  messageType: string = 'text',
  idToken?: string | null
) {
  if (!ticketId || !content) {
    throw new Error('Missing required fields');
  }

  const identity = await verifyLiffIdentity({
    lineUserId,
    idToken,
  });

  // 1. Verify Ownership — find customer by verified line_user_id
  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('id, display_name')
    .eq('line_user_id', identity.lineUserId)
    .single();

  if (customerError || !customer) {
    throw new Error('Unauthorized: Customer not found');
  }

  // 2. Verify ticket belongs to this customer
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('tickets')
    .select('id, customer_id, ticket_no')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    throw new Error('Ticket not found');
  }

  if (ticket.customer_id !== customer.id) {
    throw new Error('Unauthorized: You do not own this ticket');
  }

  // 3. Resolve Conversation ID
  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('current_ticket_id', ticketId)
    .maybeSingle();

  // 4. Insert Message Securely
  const { data: message, error: insertError } = await supabaseAdmin
    .from('messages')
    .insert([{
      ticket_id: ticketId,
      conversation_id: conversation?.id || null,
      sender_type: 'customer',
      customer_id: customer.id,
      content: content,
      message_type: messageType,
    }])
    .select()
    .single();

  if (insertError) {
    throw new Error('Failed to send message: ' + insertError.message);
  }

  // 5. Update conversation timestamp if exists
  if (conversation) {
    await supabaseAdmin
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);
  }

  // 6. Push notification to internal LINE staff group (non-blocking)
  const preview =
    messageType === 'text'
      ? content.length > 120
        ? `${content.slice(0, 120)}...`
        : content
      : `[ส่งไฟล์แนบ: ${messageType}]`;
  void notifyStaffGroupIfConfigured(
    `💬 ข้อความใหม่จากลูกค้า (#${ticket.ticket_no})\n` +
    `จาก: ${customer.display_name || 'ลูกค้า'}\n` +
    `ข้อความ: ${preview}\n` +
    `ตอบกลับ: ${APP_BASE_URL}/inbox?tid=${ticket.id}`
  );

  return message;
}

/**
 * Loads ticket details and existing CSAT submission status for /survey/[id].
 */
export async function getSurveyTicketAction(ticketId: string) {
  if (!ticketId || !UUID_REGEX.test(ticketId)) {
    return { ticket: null, alreadySubmitted: false, existingScore: null as number | null };
  }

  const [{ data: ticket }, { data: existingSurvey }] = await Promise.all([
    supabaseAdmin
      .from('tickets')
      .select('id, ticket_no, module, status, customers(display_name)')
      .eq('id', ticketId)
      .maybeSingle(),
    supabaseAdmin
      .from('csat_surveys')
      .select('score, comment, responded_at')
      .eq('ticket_id', ticketId)
      .maybeSingle(),
  ]);

  return {
    ticket: ticket || null,
    alreadySubmitted: Boolean(existingSurvey?.responded_at),
    existingScore: typeof existingSurvey?.score === 'number' ? existingSurvey.score : null,
  };
}

/**
 * Submits a CSAT survey score once per ticket. Blocks duplicate overwrites if already responded.
 */
export async function submitSurveyAction(
  ticketId: string,
  score: number,
  comment: string
): Promise<{ success: boolean; alreadySubmitted?: boolean; error?: string }> {
  if (!ticketId || !UUID_REGEX.test(ticketId)) {
    return { success: false, error: 'รหัสใบงานไม่ถูกต้อง' };
  }
  const normalizedScore = Math.floor(Number(score));
  if (!Number.isFinite(normalizedScore) || normalizedScore < 1 || normalizedScore > 5) {
    return { success: false, error: 'กรุณาให้คะแนนระหว่าง 1 ถึง 5 ดาว' };
  }

  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('id')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) {
    return { success: false, error: 'ไม่พบข้อมูลใบงานในระบบ' };
  }

  const { data: existing } = await supabaseAdmin
    .from('csat_surveys')
    .select('responded_at')
    .eq('ticket_id', ticketId)
    .maybeSingle();

  if (existing?.responded_at) {
    return {
      success: false,
      alreadySubmitted: true,
      error: 'ใบงานนี้ได้รับการประเมินความพึงพอใจเรียบร้อยแล้ว ไม่สามารถส่งซ้ำได้',
    };
  }

  const { error } = await supabaseAdmin
    .from('csat_surveys')
    .upsert(
      {
        ticket_id: ticketId,
        score: normalizedScore,
        comment: (comment || '').trim(),
        responded_at: new Date().toISOString(),
      },
      { onConflict: 'ticket_id' }
    );

  if (error) {
    return { success: false, error: `ไม่สามารถบันทึกการประเมินได้: ${error.message}` };
  }

  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
  return { success: true };
}
