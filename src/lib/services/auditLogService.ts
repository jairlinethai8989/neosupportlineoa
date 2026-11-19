import { supabase } from '@/lib/supabase';
import type { AuditLogEntry, Profile, TicketLog } from '@/types';

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  return normalized === 'admin' || normalized === 'administrator';
}

interface RawSystemAuditRow {
  id: string;
  action_type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  performer_id?: string | null;
  note?: string | null;
  details?: string | null;
  created_at: string;
}

export const auditLogService = {
  /**
   * Check whether the currently authenticated user has Admin privileges
   */
  async getCurrentUserAdminStatus(): Promise<{ isAdmin: boolean; profile: Profile | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { isAdmin: false, profile: null };

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const typedProfile = (profile as Profile | null) ?? null;
    return {
      isAdmin: isAdminRole(typedProfile?.role),
      profile: typedProfile,
    };
  },

  /**
   * Fetch unified audit logs from `ticket_logs` and (if present in DB) `audit_logs`
   */
  async fetchAuditLogs(limit = 200): Promise<AuditLogEntry[]> {
    // 1. Load staff profiles map for readable performer/target names
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, role');

    const profileMap = new Map<string, { full_name: string; role: string | null }>();
    for (const p of (profilesData as Array<{ id: string; full_name: string | null; role: string | null }> | null) ?? []) {
      profileMap.set(p.id, {
        full_name: p.full_name || 'ไม่ระบุชื่อ',
        role: p.role,
      });
    }

    // 2. Fetch ticket_logs
    const { data: ticketLogsData, error: ticketLogsError } = await supabase
      .from('ticket_logs')
      .select('*, tickets(ticket_no, subject)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (ticketLogsError) {
      throw ticketLogsError;
    }

    const mappedTicketLogs: AuditLogEntry[] = ((ticketLogsData as TicketLog[] | null) ?? []).map((row) => {
      const performer = row.performer_id ? profileMap.get(row.performer_id) : undefined;
      const targetUser = row.to_user_id ? profileMap.get(row.to_user_id) : undefined;

      return {
        id: row.id || `tl-${row.ticket_id}-${row.created_at}`,
        source: 'ticket_logs',
        action_type: row.action_type || 'update',
        entity_type: 'ticket',
        entity_id: row.ticket_id,
        ticket_no: row.tickets?.ticket_no ?? null,
        subject: row.tickets?.subject ?? null,
        from_status: row.from_status,
        to_status: row.to_status,
        performer_id: row.performer_id,
        performer_name: performer?.full_name || (row.performer_id ? `Staff (${row.performer_id.slice(0, 6)})` : 'System'),
        performer_role: performer?.role ?? null,
        target_user_id: row.to_user_id,
        target_user_name: targetUser?.full_name ?? null,
        note: row.note,
        created_at: row.created_at,
      };
    });

    // 3. Optionally merge future `audit_logs` table if it exists in Supabase
    let mappedSystemLogs: AuditLogEntry[] = [];
    const { data: sysData, error: sysError } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!sysError && Array.isArray(sysData)) {
      mappedSystemLogs = (sysData as RawSystemAuditRow[]).map((row) => {
        const performer = row.performer_id ? profileMap.get(row.performer_id) : undefined;
        const rawEntity = row.entity_type;
        const entityType: AuditLogEntry['entity_type'] =
          rawEntity === 'ticket' || rawEntity === 'staff' || rawEntity === 'sla' || rawEntity === 'master'
            ? rawEntity
            : 'system';

        return {
          id: `al-${row.id}`,
          source: 'audit_logs',
          action_type: row.action_type || 'system_event',
          entity_type: entityType,
          entity_id: row.entity_id ?? null,
          performer_id: row.performer_id ?? null,
          performer_name: performer?.full_name || 'System',
          performer_role: performer?.role ?? null,
          note: row.note ?? row.details ?? null,
          created_at: row.created_at,
        };
      });
    }

    return [...mappedTicketLogs, ...mappedSystemLogs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
};
