import { supabase } from '@/lib/supabase';
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  },

  /**
   * Get stats for a specific time range (used for daily summaries)
   */
  async getSummaryStats(startDate: string, endDate: string) {
    // 1. New tickets created in period
    const { count: newTickets } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // 2. Resolved in period
    const { count: resolved } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Resolved')
      .gte('resolved_at', startDate)
      .lte('resolved_at', endDate);

    // 3. Current Pending (Status not in Resolved/Closed)
    const { count: pending } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("Resolved","Closed")');

    // 4. SLA Breached (Due at < EndDate and not resolved)
    const { count: breached } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .lt('sla_due_at', endDate)
      .not('status', 'in', '("Resolved","Closed")');

    // 5. Top Agent (by resolution count in period)
    const { data: resolverLogs } = await supabase
      .from('ticket_logs')
      .select('performer_id, profiles(full_name)')
      .eq('action_type', 'resolve')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const solverStats: Record<string, { name: string, count: number }> = {};
    resolverLogs?.forEach((log: any) => {
      const pid = log.performer_id;
      if (!pid) return;
      if (!solverStats[pid]) solverStats[pid] = { name: log.profiles?.full_name || 'Staff', count: 0 };
      solverStats[pid].count++;
    });

    const topAgent = Object.values(solverStats).sort((a, b) => b.count - a.count)[0] || null;

    return {
      new: newTickets || 0,
      resolved: resolved || 0,
      pending: pending || 0,
      breached: breached || 0,
      topAgent
    };
  }
};
