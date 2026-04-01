import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';

export const analyticsService = {
  /**
   * Get Dashboard Overview Stats
   */
  async getOverviewStats() {
    const today = DateTime.now().startOf('day').toFormat('yyyy-MM-dd\'T\'HH:mm:ssZZ');
    const now = DateTime.now().toFormat('yyyy-MM-dd\'T\'HH:mm:ssZZ');

    // 1. Total active tickets
    const { count: activeCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("Closed","Resolved")');

    // 2. Resolved today
    const { count: resolvedToday } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Resolved')
      .gte('resolved_at', today);

    // 3. SLA Breached
    const { count: breachedCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .lt('sla_due_at', now)
      .not('status', 'in', '("Resolved","Closed")');

    return {
      activeTickets: activeCount || 0,
      resolvedToday: resolvedToday || 0,
      slaBreached: breachedCount || 0,
      avgResponseTime: '12m'
    };
  },

  async getPerformanceData(startDate: string, endDate: string) {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    return tickets || [];
  },

  async getAgentPerformance() {
    const { data: agents } = await supabase
      .from('profiles')
      .select('*, tickets(id, status, rating)');
    
    return agents?.map(agent => ({
      name: agent.full_name,
      role: agent.department,
      tickets: agent.tickets?.length || 0,
      csat: agent.tickets?.reduce((acc: number, t: any) => acc + (t.rating || 0), 0) / (agent.tickets?.length || 1) || 0
    })) || [];
  }
};
