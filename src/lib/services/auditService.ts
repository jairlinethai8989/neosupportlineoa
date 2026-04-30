import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditLogEntry {
  performer_id?: string;
  action_type: string;
  entity_type?: string;
  entity_id?: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  note?: string;
}

export const auditService = {
  /**
   * Log a system activity
   */
  async log(entry: AuditLogEntry, customClient?: SupabaseClient) {
    const client = customClient || supabase;
    try {
      const { data, error } = await client
        .from('system_logs')
        .insert([{
          ...entry,
          created_at: new Date().toISOString()
        }]);
      
      if (error) {
        console.error('Audit Log failed:', error);
      }
      return { data, error };
    } catch (err) {
      console.error('Audit Log critical error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetch system logs with filters
   */
  async getSystemLogs(filters: { 
    agentId?: string, 
    actionType?: string, 
    limit?: number 
  } = {}, customClient?: SupabaseClient) {
    const client = customClient || supabase;
    let query = client
      .from('system_logs')
      .select(`
        *,
        performer:profiles!performer_id(full_name, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (filters.agentId && filters.agentId !== 'all') {
      query = query.eq('performer_id', filters.agentId);
    }
    if (filters.actionType && filters.actionType !== 'all') {
      query = query.eq('action_type', filters.actionType);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }
};
