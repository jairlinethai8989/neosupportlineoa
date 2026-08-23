'use server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import { parseAuditLogFilters } from '@/lib/settings/auditLogSecurity';

export async function getSystemLogsAction(value: unknown = {}) {
  await requireStaffAuth({ permission: 'settings_audit', level: 'view' });
  const filters = parseAuditLogFilters(value);

  let query = supabaseAdmin
    .from('system_logs')
    .select(`
      id, performer_id, action_type, entity_type, entity_id,
      old_data, new_data, note, created_at,
      performer:profiles!performer_id(full_name, avatar_url, role)
    `)
    .order('created_at', { ascending: false })
    .limit(filters.limit);

  if (filters.agentId) query = query.eq('performer_id', filters.agentId);
  if (filters.actionType) query = query.eq('action_type', filters.actionType);

  const { data, error } = await query;
  if (error) throw new Error('Failed to load system logs');
  return data || [];
}

export async function getTicketAuditLogsAction(value: unknown = {}) {
  await requireStaffAuth({ permission: 'settings_audit', level: 'view' });
  const filters = parseAuditLogFilters(value);
  let query = supabaseAdmin
    .from('ticket_logs')
    .select(`
      id, ticket_id, performer_id, to_user_id, action_type, from_status,
      to_status, old_data, new_data, note, created_at,
      performer:profiles!performer_id(full_name, avatar_url),
      target_user:profiles!to_user_id(full_name),
      tickets(ticket_no, subject)
    `)
    .order('created_at', { ascending: false })
    .limit(filters.limit);
  if (filters.agentId) query = query.eq('performer_id', filters.agentId);
  if (filters.actionType) query = query.eq('action_type', filters.actionType);
  const { data, error } = await query;
  if (error) throw new Error('Failed to load ticket audit logs');
  return data || [];
}

export async function getAuditAgentsAction() {
  await requireStaffAuth({ permission: 'settings_audit', level: 'view' });
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name')
    .order('full_name');
  if (error) throw new Error('Failed to load audit agents');
  return (data || []).map((row) => ({ id: row.id, full_name: row.full_name }));
}

export async function clearSystemLogsAction() {
  try {
    await requireStaffAuth({ roles: ['Administrator'] });

    const { error } = await supabaseAdmin
      .from('system_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Clear System Logs Error:', err);
    return { success: false, error: message };
  }
}

export async function clearTicketLogsAction() {
  try {
    await requireStaffAuth({ roles: ['Administrator'] });

    const { error } = await supabaseAdmin
      .from('ticket_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Clear Ticket Logs Error:', err);
    return { success: false, error: message };
  }
}
