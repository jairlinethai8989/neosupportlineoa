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
      .select('*, tickets(id, status, csat_surveys(score, rating))');
    
    return agents?.map(agent => {
      const ticketsWithCSAT = agent.tickets?.filter((t: any) => t.csat_surveys && (t.csat_surveys.score || t.csat_surveys.rating)) || [];
      const totalScore = ticketsWithCSAT.reduce((acc: number, t: any) => acc + (t.csat_surveys.score || t.csat_surveys.rating || 0), 0);
      const avgCSAT = ticketsWithCSAT.length > 0 ? totalScore / ticketsWithCSAT.length : 0;

      return {
        name: agent.full_name,
        role: agent.department,
        tickets: agent.tickets?.length || 0,
        csat: avgCSAT
      };
    }) || [];
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

    // 3. Status-Specific Counts (Current Totals)
    const { count: inProgress } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'In Progress');

    const { count: escalated } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Escalated');

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

    return {
      total: pending || 0, // All non-resolved
      new: newTickets || 0,
      resolved: resolved || 0,
      inProgress: inProgress || 0,
      transferred: escalated || 0,
      breached: breached || 0
    };
  },

  /**
   * Get detailed ticket list for the summary
   * Includes both newly created AND resolved tickets in that period
   */
  async getDetailedSummary(startDate: string, endDate: string) {
    // Correct way to do OR with multiple conditions in Supabase:
    // Fetch all that was created OR resolved after startDate
    // Values with + or - must be quoted for .or() filter
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        ticket_no,
        subject,
        status,
        created_at,
        resolved_at,
        hospital_id,
        hospitals(name),
        profiles!assigned_agent_id (
          full_name
        )
      `)
      .or(`created_at.gte."${startDate}",resolved_at.gte."${startDate}"`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Detailed Summary Fetch Error:', error);
      return [];
    }

    // Filter in JS for precision (within the exact range)
    const filtered = (data || []).filter(t => {
      const isNew = t.created_at >= startDate && t.created_at <= endDate;
      const isResolved = t.resolved_at && t.resolved_at >= startDate && t.resolved_at <= endDate;
      return isNew || isResolved;
    });

    return filtered;
  }
};
