'use server';

import {
  parseAnalyticsDateRange,
  parseEvaluationLookupRequest,
  parseStaffAnalyticsRequest,
} from '@/lib/analytics/analyticsReadSecurity';
import { parseGeneratedStaffEvaluation } from '@/lib/analytics/staffEvaluationSecurity';
import { parseEvaluation360Read } from '@/lib/analytics/staffEvaluation360';
import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { analyticsQueries } from '@/lib/tickets/analyticsQueries';

export async function getPersonalAnalyticsAction(value: unknown) {
  const { user } = await requireStaffAuth({ permission: 'analytics_personal', level: 'view' });
  const input = parseAnalyticsDateRange(value);
  return analyticsQueries.getAgentAnalytics(user.id, input.startDate, input.endDate);
}

export async function getStaffAnalyticsOptionsAction() {
  await requireStaffAuth({ permission: 'analytics_staff', level: 'view' });
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, status')
    .in('role', ['Agent', 'Administrator'])
    .order('full_name', { ascending: true })
    .limit(1_000);
  if (error) throw new Error('Failed to load staff analytics options');
  return (data || []).map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
    status: profile.status,
  }));
}

export async function getStaffAnalyticsAction(value: unknown) {
  await requireStaffAuth({ permission: 'analytics_staff', level: 'view' });
  const input = parseStaffAnalyticsRequest(value);
  const [analytics, teamStats] = await Promise.all([
    analyticsQueries.getAgentAnalytics(input.agentId, input.startDate, input.endDate),
    analyticsQueries.getTeamAnalytics(input.startDate, input.endDate),
  ]);
  return { analytics, teamStats };
}

export async function getExistingStaffEvaluationAction(value: unknown) {
  await requireStaffAuth({ permission: 'analytics_staff', level: 'view' });
  const input = parseEvaluationLookupRequest(value);
  const { data, error } = await supabaseAdmin
    .from('staff_evaluations')
    .select('evaluation_data')
    .eq('agent_id', input.agentId)
    .eq('start_date', input.startDate)
    .eq('end_date', input.endDate)
    .maybeSingle();
  if (error) throw new Error('Failed to load staff evaluation');
  if (!data?.evaluation_data) return null;
  try {
    return parseGeneratedStaffEvaluation(data.evaluation_data);
  } catch {
    return null;
  }
}

export async function getEvaluation360WorkspaceAction(value: unknown) {
  const { user } = await requireStaffAuth({ permission: 'analytics_staff', level: 'view' });
  const input = parseEvaluation360Read(value);
  const [ticketsResult, evaluationResult] = await Promise.all([
    supabaseAdmin
      .from('tickets')
      .select('status, created_at, updated_at, priority, csat_score:csat_surveys(score)')
      .eq('assigned_agent_id', input.agentId)
      .gte('created_at', `${input.startDate}T00:00:00.000Z`)
      .lte('created_at', `${input.endDate}T23:59:59.999Z`)
      .limit(10_000),
    supabaseAdmin
      .from('staff_evaluations_360')
      .select(`
        system_data_expertise, troubleshooting_sla, shift_availability,
        handover_quality, knowledge_sharing, crisis_communication,
        emotional_regulation, learning_agility, comments, is_ai_generated
      `)
      .eq('agent_id', input.agentId)
      .eq('evaluator_id', user.id)
      .eq('evaluation_period', input.period)
      .eq('evaluator_role', input.evaluatorRole)
      .maybeSingle(),
  ]);
  if (ticketsResult.error || evaluationResult.error) {
    throw new Error('Failed to load evaluation workspace');
  }

  const tickets = ticketsResult.data || [];
  const resolved = tickets.filter((ticket) => ticket.status === 'Resolved' || ticket.status === 'Closed');
  let resolutionHours = 0;
  let timedResolved = 0;
  let slaCompliant = 0;
  let reworkCount = 0;
  let csatSum = 0;
  let csatCount = 0;

  for (const ticket of tickets) {
    if (ticket.created_at && ticket.updated_at && (ticket.status === 'Resolved' || ticket.status === 'Closed')) {
      const hours = (Date.parse(ticket.updated_at) - Date.parse(ticket.created_at)) / 3_600_000;
      if (Number.isFinite(hours) && hours >= 0) {
        resolutionHours += hours;
        timedResolved++;
        const threshold = ticket.priority === 'Critical' || ticket.priority === 'High' ? 4 : 24;
        if (hours <= threshold) slaCompliant++;
      }
    }
    if (ticket.status === 'Rejected' || ticket.status === 'Escalated') reworkCount++;
    const relation = ticket.csat_score as unknown as { score?: number } | { score?: number }[] | null;
    const score = Array.isArray(relation) ? relation[0]?.score : relation?.score;
    if (typeof score === 'number' && Number.isFinite(score) && score >= 1 && score <= 5) {
      csatSum += score;
      csatCount++;
    }
  }

  const totalClaimed = tickets.length;
  return {
    kpiStats: {
      totalClaimed,
      resolvedCount: resolved.length,
      avgResolutionTime: timedResolved ? Number((resolutionHours / timedResolved).toFixed(1)) : 0,
      slaComplianceRate: resolved.length ? Math.round((slaCompliant / resolved.length) * 100) : 100,
      reworkRate: totalClaimed ? Math.round((reworkCount / totalClaimed) * 100) : 0,
      avgCsat: csatCount ? Number((csatSum / csatCount).toFixed(2)) : 0,
    },
    evaluation: evaluationResult.data || null,
  };
}
