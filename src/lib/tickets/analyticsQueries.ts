import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';

export interface AgentStats {
  activeCount: number;
  resolvedCount: number;
  totalClaimed: number;
  reworkCount: number;
  reworkRate: number;
  avgResolutionTime: number; // in hours
  slaCompliantCount: number;
  slaComplianceRate: number; // 0 to 100
  avgCsat: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface SlaDataPoint {
  name: string;
  value: number;
}

export interface AgentTimelineItem {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
  ticketNo: string;
  subject: string;
}

export interface AgentAnalyticsData {
  stats: AgentStats;
  resolutionTrend: ChartDataPoint[];
  priorityData: ChartDataPoint[];
  categoryData: ChartDataPoint[];
  slaData: SlaDataPoint[];
  timeline: AgentTimelineItem[];
}

export const analyticsQueries = {
  /**
   * Fetches comprehensive analytics and dashboard data for a single agent
   */
  async getAgentAnalytics(
    agentId: string,
    startDateStr: string,
    endDateStr: string
  ): Promise<AgentAnalyticsData> {
    const start = DateTime.fromISO(startDateStr).startOf('day').toJSDate();
    const end = DateTime.fromISO(endDateStr).endOf('day').toJSDate();

    // 1. Fetch all tickets currently assigned to this agent
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        id,
        ticket_no,
        subject,
        status,
        priority,
        issue_type,
        created_at,
        resolved_at,
        sla_due_at
      `)
      .eq('assigned_agent_id', agentId);

    if (ticketsError) throw ticketsError;

    const agentTickets = tickets || [];

    // 2. Statistics breakdown
    const activeCount = agentTickets.filter((t) =>
      ['Assigned', 'In Progress', 'Escalated', 'Pending'].includes(t.status)
    ).length;

    // Filter resolved tickets within selected date range
    const resolvedTickets = agentTickets.filter((t) => {
      if (!['Resolved', 'Closed'].includes(t.status)) return false;
      if (!t.resolved_at) return false;
      const resDate = new Date(t.resolved_at);
      return resDate >= start && resDate <= end;
    });

    const resolvedCount = resolvedTickets.length;
    const totalClaimed = agentTickets.length;

    // 3. Rework events count
    // Fetch log records for tickets assigned to this agent where state returned from Fix Completed
    const { data: reworkLogs, error: reworkError } = await supabase
      .from('ticket_logs')
      .select('id, ticket:tickets!inner(assigned_agent_id)')
      .eq('tickets.assigned_agent_id', agentId)
      .eq('from_status', 'Fix Completed')
      .in('to_status', ['In Progress', 'Pending', 'Escalated', 'Assigned']);

    if (reworkError) throw reworkError;
    const reworkCount = reworkLogs?.length || 0;
    const reworkRate = resolvedCount > 0 ? parseFloat(((reworkCount / resolvedCount) * 100).toFixed(1)) : 0;

    // 4. SLA Compliance & Average Resolution Time
    let totalResolutionHours = 0;
    let slaCompliantCount = 0;
    let slaRatedTicketsCount = 0;

    resolvedTickets.forEach((t) => {
      const created = new Date(t.created_at);
      const resolved = new Date(t.resolved_at!);
      const diffHours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
      totalResolutionHours += diffHours;

      if (t.sla_due_at) {
        slaRatedTicketsCount++;
        const due = new Date(t.sla_due_at);
        if (resolved <= due) {
          slaCompliantCount++;
        }
      }
    });

    const avgResolutionTime = resolvedCount > 0 ? parseFloat((totalResolutionHours / resolvedCount).toFixed(1)) : 0;
    const slaComplianceRate =
      slaRatedTicketsCount > 0 ? Math.round((slaCompliantCount / slaRatedTicketsCount) * 100) : 100;

    // 5. Average CSAT Score
    const { data: csatSurveys, error: csatError } = await supabase
      .from('csat_surveys')
      .select('score, tickets!inner(assigned_agent_id)')
      .eq('tickets.assigned_agent_id', agentId)
      .not('score', 'is', null);

    if (csatError) throw csatError;

    const scores = (csatSurveys || []).map((c) => c.score).filter(Boolean) as number[];
    const avgCsat = scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;

    // 6. Resolution Trend (grouped by day)
    const dailyCounts: Record<string, number> = {};
    // Pre-fill last 15 days of the range with 0 to ensure continuous charts
    let temp = DateTime.fromISO(startDateStr).startOf('day');
    const endLimit = DateTime.fromISO(endDateStr).endOf('day');
    while (temp.toMillis() <= endLimit.toMillis()) {
      dailyCounts[temp.toFormat('dd MMM')] = 0;
      temp = temp.plus({ days: 1 });
    }

    resolvedTickets.forEach((t) => {
      const dateStr = DateTime.fromISO(t.resolved_at!).toFormat('dd MMM');
      if (dailyCounts[dateStr] !== undefined) {
        dailyCounts[dateStr]++;
      } else {
        dailyCounts[dateStr] = 1;
      }
    });

    const resolutionTrend = Object.entries(dailyCounts).map(([name, value]) => ({
      name,
      value,
    }));

    // 7. Workload by Priority
    const priorityCounts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    agentTickets.forEach((t) => {
      if (priorityCounts[t.priority] !== undefined) {
        priorityCounts[t.priority]++;
      }
    });
    const priorityData = Object.entries(priorityCounts).map(([name, value]) => ({
      name,
      value,
    }));

    // 8. Workload by Category (Issue Type)
    const categoryCounts: Record<string, number> = {};
    agentTickets.forEach((t) => {
      const cat = t.issue_type || 'General/Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const categoryData = Object.entries(categoryCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // 9. SLA compliance Doughnut Data
    const slaData = [
      { name: 'Compliant (ผ่านเกณฑ์)', value: slaCompliantCount },
      { name: 'Breached (เกินกำหนด)', value: slaRatedTicketsCount - slaCompliantCount },
    ];

    // 10. Activity Timeline (logs from ticket_logs performers)
    const { data: timelineLogs, error: timelineError } = await supabase
      .from('ticket_logs')
      .select(`
        id,
        action_type,
        from_status,
        to_status,
        note,
        created_at,
        ticket:tickets(ticket_no, subject)
      `)
      .eq('performer_id', agentId)
      .order('created_at', { ascending: false })
      .limit(15);

    if (timelineError) throw timelineError;

    const timeline = (((timelineLogs as unknown) as Array<{
      id: string;
      action_type: string;
      from_status: string | null;
      to_status: string | null;
      note: string | null;
      created_at: string;
      ticket: { ticket_no: string; subject: string; } | null;
    }>) || []).map((l) => ({
      id: l.id,
      action: l.action_type,
      fromStatus: l.from_status,
      toStatus: l.to_status,
      note: l.note,
      createdAt: l.created_at,
      ticketNo: l.ticket?.ticket_no || 'N/A',
      subject: l.ticket?.subject || 'N/A',
    }));

    return {
      stats: {
        activeCount,
        resolvedCount,
        totalClaimed,
        reworkCount,
        reworkRate,
        avgResolutionTime,
        slaCompliantCount,
        slaComplianceRate,
        avgCsat,
      },
      resolutionTrend,
      priorityData,
      categoryData,
      slaData,
      timeline,
    };
  },
};
