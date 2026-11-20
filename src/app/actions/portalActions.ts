'use server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  notifyStaffGroupIfConfigured,
  shouldNotifyStaffGroupOnMessage,
} from '@/lib/utils/lineNotifications';
import { verifyLiffIdentity } from '@/lib/auth/verifyLiffToken';
import { calculateSlaDeadline } from '@/lib/utils/slaUtils';
import { invalidateAllLiveCaches } from '@/lib/cache/liveCache';
import { invalidateAllPreviewCaches } from '@/lib/reports/previewCache';
import { resolveProjectById, resolveProjectBySlug } from '@/lib/projects/projectResolver';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://neoworkspace.vercel.app').replace(/\/$/, '');

/**
 * Securely creates a new support ticket from the Customer Portal.
 * Verifies LINE LIFF ID token server-side against the project's LINE channel,
 * calculates hybrid SLA, creates ticket/conversation/messages scoped by project_id,
 * and pushes a notification to the project's internal LINE staff group if configured.
 */
export async function createPortalTicketAction(input: {
  lineUserId?: string | null;
  idToken?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  subject: string;
  description: string;
  attachmentUrl?: string | null;
}) {
  const subject = input.subject?.trim();
  const description = input.description?.trim();
  if (!subject) throw new Error('กรุณาเลือกหัวข้อปัญหา');
  if (!description) throw new Error('กรุณาระบุรายละเอียดเพิ่มเติม');

  const project = input.projectId
    ? await resolveProjectById(input.projectId)
    : await resolveProjectBySlug(input.projectSlug);
  const realProjectId = project && project.id !== 'default-env-fallback' ? project.id : null;

  const identity = await verifyLiffIdentity({
    lineUserId: input.lineUserId,
    idToken: input.idToken,
    channelId: project?.line_channel_id,
    liffId: project?.line_liff_id,
  });

  let customerQuery = supabaseAdmin
    .from('customers')
    .select('id, display_name, organization_id, department_id, project_id, organizations(name, abbreviation)')
    .eq('line_user_id', identity.lineUserId);

  if (realProjectId) {
    customerQuery = customerQuery.eq('project_id', realProjectId);
  }

  const { data: customer, error: customerError } = await customerQuery.limit(1).maybeSingle();

  if (customerError || !customer) {
    throw new Error('ไม่พบข้อมูลลูกค้าในระบบ กรุณาลงทะเบียนก่อนใช้งาน');
  }
  if (!customer.organization_id) {
    throw new Error('กรุณาลงทะเบียนหน่วยงานก่อนเปิดใบงาน');
  }

  const effectiveProjectId = (customer as { project_id?: string | null }).project_id || realProjectId;

  const orgRel = Array.isArray(customer.organizations)
    ? customer.organizations[0]
    : customer.organizations;
  const hospitalAbbr = (orgRel as { abbreviation?: string | null } | null)?.abbreviation || project?.code || 'NEO';
  const orgName = (orgRel as { name?: string | null } | null)?.name || 'ไม่ระบุหน่วยงาน';

  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ticketNo = `${hospitalAbbr}-${dateStr}-${randomSuffix}`;

  let slaDueAt: string | null = null;
  try {
    let slaQuery = supabaseAdmin
      .from('sla_rules')
      .select('response_time_minutes, resolution_time_minutes, project_id')
      .eq('priority', 'Medium');

    if (effectiveProjectId) {
      slaQuery = slaQuery.or(`project_id.is.null,project_id.eq.${effectiveProjectId}`);
    }

    const { data: slaRules } = await slaQuery;
    const projectSpecificRule = (slaRules || []).find((r) => r.project_id === effectiveProjectId);
    const slaRule = projectSpecificRule || (slaRules || [])[0] || null;

    if (slaRule) {
      const duration = slaRule.resolution_time_minutes || slaRule.response_time_minutes || 60;
      slaDueAt = calculateSlaDeadline(now, duration).toISOString();
    }
  } catch (slaErr) {
    console.warn('Portal create SLA calculation skipped:', slaErr);
  }

  const ticketInsertPayload: Record<string, unknown> = {
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
  };
  if (effectiveProjectId) {
    ticketInsertPayload.project_id = effectiveProjectId;
  }

  const { data: createdTicket, error: ticketError } = await supabaseAdmin
    .from('tickets')
    .insert([ticketInsertPayload])
    .select()
    .single();

  if (ticketError || !createdTicket) {
    throw new Error(`Ticket Creation Failed: ${ticketError?.message || 'Unknown error'}`);
  }

  const convInsertPayload: Record<string, unknown> = {
    customer_id: customer.id,
    status: 'active',
    current_ticket_id: createdTicket.id,
    last_message_at: now.toISOString(),
  };
  if (effectiveProjectId) {
    convInsertPayload.project_id = effectiveProjectId;
  }

  const { data: newConv } = await supabaseAdmin
    .from('conversations')
    .insert([convInsertPayload])
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
        media_path: input.attachmentUrl,
        is_internal: false,
      }]);
    }

    await supabaseAdmin.from('messages').insert([{
      ticket_id: createdTicket.id,
      conversation_id: conversationId,
      sender_type: 'customer',
      customer_id: customer.id,
      message_type: 'text',
      content: description,
      is_internal: false,
    }]);
  }

  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();

  const preview = description.length > 140 ? `${description.slice(0, 140)}...` : description;
  const projectLabel = project?.name ? `[${project.name}] ` : '';
  void notifyStaffGroupIfConfigured(
    `🆕 ${projectLabel}ใบงานใหม่ #${ticketNo}\n` +
    `หน่วยงาน: ${orgName}\n` +
    `ผู้แจ้ง: ${customer.display_name || 'ลูกค้า'}\n` +
    `หัวข้อ: ${subject}\n` +
    `รายละเอียด: ${preview}\n` +
    `เปิดดู: ${APP_BASE_URL}/tickets/${createdTicket.id}`,
    effectiveProjectId
  );

  return { ticket: createdTicket };
}

/**
 * Securely sends a message from the Portal (Customer side).
 * Verifies LINE LIFF ID token against the ticket's project channel and checks ticket ownership.
 * Optionally pushes LINE staff group alert only when the project enables message-level alerts.
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

  // 1. Resolve ticket first so we can verify LIFF token against the ticket's project channel
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('tickets')
    .select('id, customer_id, ticket_no, project_id')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    throw new Error('Ticket not found');
  }

  const projectId = (ticket as { project_id?: string | null }).project_id || null;
  const project = projectId ? await resolveProjectById(projectId) : await resolveProjectBySlug(null);

  const identity = await verifyLiffIdentity({
    lineUserId,
    idToken,
    channelId: project?.line_channel_id,
    liffId: project?.line_liff_id,
  });

  // 2. Verify Ownership — find customer by verified line_user_id within this project
  let customerQuery = supabaseAdmin
    .from('customers')
    .select('id, display_name')
    .eq('line_user_id', identity.lineUserId);

  if (projectId) {
    customerQuery = customerQuery.eq('project_id', projectId);
  }

  const { data: customer, error: customerError } = await customerQuery.limit(1).maybeSingle();

  if (customerError || !customer) {
    throw new Error('Unauthorized: Customer not found');
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
      media_path: messageType !== 'text' ? content : null,
      message_type: messageType,
      is_internal: false,
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

  // 6. Push notification to internal LINE staff group only if project enabled routine message alerts
  const shouldNotify = await shouldNotifyStaffGroupOnMessage(projectId);
  if (shouldNotify) {
    const preview =
      messageType === 'text'
        ? content.length > 120
          ? `${content.slice(0, 120)}...`
          : content
        : `[ส่งไฟล์แนบ: ${messageType}]`;
    const projectLabel = project?.name ? `[${project.name}] ` : '';
    void notifyStaffGroupIfConfigured(
      `💬 ${projectLabel}ข้อความใหม่จากลูกค้า (#${ticket.ticket_no})\n` +
      `จาก: ${customer.display_name || 'ลูกค้า'}\n` +
      `ข้อความ: ${preview}\n` +
      `ตอบกลับ: ${APP_BASE_URL}/inbox?tid=${ticket.id}`,
      projectId
    );
  }

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

/**
 * Registers or updates a customer profile from the Customer Portal / LINE LIFF.
 * Uses supabaseAdmin after verifying LINE LIFF identity to safely bypass anon RLS restrictions.
 */
export async function registerPortalCustomerAction(input: {
  lineUserId?: string | null;
  idToken?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  displayName: string;
  lineUsername?: string | null;
  pictureUrl?: string | null;
  organizationId: string;
  departmentId: string;
  positionId: string;
}): Promise<{ success: boolean; customerId?: string; error?: string }> {
  try {
    const displayName = input.displayName?.trim();
    if (!displayName) {
      return { success: false, error: 'กรุณาระบุชื่อ-นามสกุลผู้ใช้งาน' };
    }
    if (!input.organizationId || !input.departmentId || !input.positionId) {
      return { success: false, error: 'กรุณาระบุข้อมูลหน่วยงาน แผนก และตำแหน่งให้ครบถ้วน' };
    }

    const project = input.projectId
      ? await resolveProjectById(input.projectId)
      : await resolveProjectBySlug(input.projectSlug);
    const realProjectId = project && project.id !== 'default-env-fallback' ? project.id : null;

    const identity = await verifyLiffIdentity({
      lineUserId: input.lineUserId,
      idToken: input.idToken,
      channelId: project?.line_channel_id,
      liffId: project?.line_liff_id,
    });

    let existingQuery = supabaseAdmin
      .from('customers')
      .select('id')
      .eq('line_user_id', identity.lineUserId);

    if (realProjectId) {
      existingQuery = existingQuery.eq('project_id', realProjectId);
    }

    const { data: existing } = await existingQuery.limit(1).maybeSingle();

    const payload: Record<string, unknown> = {
      line_user_id: identity.lineUserId,
      display_name: displayName,
      full_name: displayName,
      line_username: input.lineUsername || null,
      organization_id: input.organizationId,
      department_id: input.departmentId,
      position_id: input.positionId,
      updated_at: new Date().toISOString(),
    };

    if (input.pictureUrl) {
      payload.avatar_url = input.pictureUrl;
    }
    if (realProjectId) {
      payload.project_id = realProjectId;
    }

    const writeCustomer = async (row: Record<string, unknown>) => {
      if (existing?.id) {
        return supabaseAdmin
          .from('customers')
          .update(row)
          .eq('id', existing.id)
          .select('id')
          .single();
      }
      return supabaseAdmin
        .from('customers')
        .insert([row])
        .select('id')
        .single();
    };

    let { data: saved, error: saveError } = await writeCustomer(payload);

    if (saveError?.code === 'PGRST204' && String(saveError.message || '').includes('avatar_url')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.avatar_url;
      const fallback = await writeCustomer(fallbackPayload);
      saved = fallback.data;
      saveError = fallback.error;
    }

    if (saveError) {
      return { success: false, error: saveError.message || 'ไม่สามารถบันทึกข้อมูลผู้ใช้งานได้' };
    }

    invalidateAllLiveCaches();
    invalidateAllPreviewCaches();
    return { success: true, customerId: saved?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลผู้ใช้งานได้';
    return { success: false, error: message };
  }
}

/**
 * Syncs basic LINE profile metadata (avatar, LINE display name) upon LIFF initialization.
 * Preserves existing registered display_name if customer is already registered.
 */
export async function syncLiffCustomerProfileAction(input: {
  lineUserId?: string | null;
  idToken?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  displayName: string;
  pictureUrl?: string | null;
}): Promise<{ success: boolean }> {
  try {
    const project = input.projectId
      ? await resolveProjectById(input.projectId)
      : await resolveProjectBySlug(input.projectSlug);
    const realProjectId = project && project.id !== 'default-env-fallback' ? project.id : null;

    const identity = await verifyLiffIdentity({
      lineUserId: input.lineUserId,
      idToken: input.idToken,
      channelId: project?.line_channel_id,
      liffId: project?.line_liff_id,
    });

    let existingQuery = supabaseAdmin
      .from('customers')
      .select('id, display_name, organization_id')
      .eq('line_user_id', identity.lineUserId);

    if (realProjectId) {
      existingQuery = existingQuery.eq('project_id', realProjectId);
    }

    const { data: existing } = await existingQuery.limit(1).maybeSingle();

    const metadata = {
      line_profile: {
        display_name: input.displayName,
        picture_url: input.pictureUrl || null,
        synced_at: new Date().toISOString(),
      },
    };

    const payload: Record<string, unknown> = {
      line_user_id: identity.lineUserId,
      avatar_url: input.pictureUrl || null,
      line_username: input.displayName,
      metadata,
      updated_at: new Date().toISOString(),
    };

    if (!existing?.organization_id || !existing?.display_name) {
      payload.display_name = input.displayName;
    }
    if (realProjectId) {
      payload.project_id = realProjectId;
    }

    const writeRow = async (row: Record<string, unknown>) => {
      if (existing?.id) {
        return supabaseAdmin.from('customers').update(row).eq('id', existing.id);
      }
      return supabaseAdmin.from('customers').insert([row]);
    };

    let { error: syncError } = await writeRow(payload);

    if (syncError?.code === 'PGRST204' && String(syncError.message || '').includes('avatar_url')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.avatar_url;
      const fallback = await writeRow(fallbackPayload);
      syncError = fallback.error;
    }

    if (syncError) {
      console.warn('syncLiffCustomerProfileAction warning:', syncError.message);
      return { success: false };
    }

    return { success: true };
  } catch (err) {
    console.warn('syncLiffCustomerProfileAction skipped:', err);
    return { success: false };
  }
}
