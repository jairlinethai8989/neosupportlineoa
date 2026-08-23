import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DateTime } from 'luxon';

export const analyticsService = {
  /**
   * Get Dashboard Overview Stats
   */
  async getOverviewStats() {
    const today = DateTime.now().startOf('day').toFormat('yyyy-MM-dd\'T\'HH:mm:ssZZ');
    const now = DateTime.now().toFormat('yyyy-MM-dd\'T\'HH:mm:ssZZ');

    const [activeRes, resolvedRes, breachedRes] = await Promise.all([
      supabaseAdmin
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("Closed","Resolved")'),
      supabaseAdmin
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Resolved')
        .gte('resolved_at', today),
      supabaseAdmin
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .lt('sla_due_at', now)
        .not('status', 'in', '("Resolved","Closed")')
    ]);

    return {
      activeTickets: activeRes.count || 0,
      resolvedToday: resolvedRes.count || 0,
      slaBreached: breachedRes.count || 0,
      avgResponseTime: '12m'
    };
  },

  async getPerformanceData(startDate: string, endDate: string) {
    const { data: tickets } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    return tickets || [];
  },

  async getAgentPerformance() {
    const { data: agents } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, department, tickets(id, status, csat_surveys(score))');
    
    return agents?.map(agent => {
      const ticketsWithCSAT = agent.tickets?.filter((t: any) => t.csat_surveys && t.csat_surveys.score) || [];
      const totalScore = ticketsWithCSAT.reduce((acc: number, t: any) => acc + (t.csat_surveys.score || 0), 0);
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
    const [newTicketsRes, resolvedRes, inProgressRes, escalatedRes, pendingRes, breachedRes] = await Promise.all([
      supabaseAdmin
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate)
        .lte('created_at', endDate),
      supabaseAdmin
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Resolved')
        .gte('resolved_at', startDate)
        .lte('resolved_at', endDate),
      supabaseAdmin
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'In Progress'),
      supabaseAdmin
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Escalated'),
      supabaseAdmin
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("Resolved","Closed")'),
      supabaseAdmin
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .lt('sla_due_at', endDate)
        .not('status', 'in', '("Resolved","Closed")')
    ]);

    return {
      total: pendingRes.count || 0, // All non-resolved
      new: newTicketsRes.count || 0,
      resolved: resolvedRes.count || 0,
      inProgress: inProgressRes.count || 0,
      transferred: escalatedRes.count || 0,
      breached: breachedRes.count || 0
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
    const { data, error } = await supabaseAdmin
      .from('tickets')
      .select(`
        id,
        ticket_no,
        subject,
        status,
        created_at,
        resolved_at,
        organization_id,
        organizations(name),
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
