'use server';

import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import { parseDashboardExportInput, toAnalyticsDashboardDto } from '@/lib/analytics/dashboardSecurity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

export async function getDashboardFilterOptionsAction() {
  await requireStaffAuth({ permission: 'analytics', level: 'view' });
  const [modules, issueTypes] = await Promise.all([
    supabaseAdmin.from('ticket_modules').select('name').eq('is_active', true).order('name'),
    supabaseAdmin.from('ticket_issue_types').select('name').eq('is_active', true).order('name'),
  ]);
  if (modules.error || issueTypes.error) throw new Error('Failed to load dashboard filters');
  const names = (rows: Array<{ name?: unknown }> | null) => (rows || [])
    .map((row) => typeof row.name === 'string' ? row.name : '')
    .filter(Boolean);
  return { modules: names(modules.data), issueTypes: names(issueTypes.data) };
}

export async function getDashboardExportTicketsAction(value: unknown) {
  await requireStaffAuth({ permission: 'analytics', level: 'view' });
  const input = parseDashboardExportInput(value);
  let query = supabaseAdmin.from('tickets').select(`
    id, ticket_no, subject, status, priority, created_at, updated_at,
    customers!tickets_customer_id_fkey(display_name),
    assigned_agent:profiles!assigned_agent_id(full_name)
  `).gte('created_at', input.from).lte('created_at', input.to);
  if (input.organizationId) query = query.eq('organization_id', input.organizationId);
  if (input.module) query = query.eq('module', input.module);
  if (input.issueType) query = query.eq('issue_type', input.issueType);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(10_000);
  if (error) throw new Error('Failed to load dashboard export');
  return (data || []).map((row) => ({
    id: row.id,
    ticket_no: row.ticket_no,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer_name: one(row.customers)?.display_name || '-',
    agent_name: one(row.assigned_agent)?.full_name || '-',
    resolved_at: row.updated_at,
  }));
}

export async function getAnalyticsDashboardAction(value: unknown) {
  await requireStaffAuth({ permission: 'analytics', level: 'view' });
  const input = parseDashboardExportInput(value);
  const { data, error } = await supabaseAdmin.rpc('get_analytics_dashboard_v2', {
    start_date: input.from.slice(0, 10),
    end_date: input.to.slice(0, 10),
  });
  if (error) throw new Error('Failed to load analytics dashboard');
  return toAnalyticsDashboardDto(data);
}
