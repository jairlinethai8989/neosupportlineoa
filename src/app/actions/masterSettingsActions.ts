'use server';

import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import {
  parseMasterCreateInput,
  parseMasterListTab,
  parseMasterToggleInput,
  parseMasterUpdateInput,
  toMasterDataDto,
} from '@/lib/settings/masterDataSecurity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function writeMasterAudit(
  performerId: string,
  actionType: 'MASTER_CREATE' | 'MASTER_UPDATE' | 'MASTER_TOGGLE',
  table: string,
  entityId: string | null,
  data: Record<string, unknown>
) {
  const { error } = await supabaseAdmin.from('system_logs').insert([{
    performer_id: performerId,
    action_type: actionType,
    entity_type: table.toUpperCase(),
    entity_id: entityId,
    new_data: data,
    note: `${actionType} ${table}`,
    created_at: new Date().toISOString(),
  }]);
  if (error) throw new Error('Failed to record master-data audit');
}

export async function listMasterDataAction(tabValue: unknown) {
  await requireStaffAuth({ permission: 'settings_master', level: 'view' });
  const input = parseMasterListTab(tabValue);
  let query = supabaseAdmin.from(input.table).select('*').order('name');
  if (input.tab === 'departments' || input.tab === 'hospital_depts') {
    query = query.eq('dept_type', 'organization');
  }
  const { data, error } = await query;
  if (error) throw new Error('Failed to load master data');
  return (data || []).map((row) => toMasterDataDto(input.tab, row));
}

export async function getStaffTicketOptionsAction() {
  await requireStaffAuth();
  const [modules, issueTypes, subjectTypes] = await Promise.all([
    supabaseAdmin.from('ticket_modules').select('name').eq('is_active', true).order('name'),
    supabaseAdmin.from('ticket_issue_types').select('name').eq('is_active', true).order('name'),
    supabaseAdmin.from('ticket_subject_types').select('name').eq('is_active', true).order('name'),
  ]);
  if (modules.error || issueTypes.error || subjectTypes.error) {
    throw new Error('Failed to load ticket options');
  }
  const names = (rows: Array<{ name?: unknown }> | null) => (rows || [])
    .map((row) => typeof row.name === 'string' ? row.name : '')
    .filter(Boolean);
  return {
    modules: names(modules.data),
    issueTypes: names(issueTypes.data),
    subjectTypes: names(subjectTypes.data),
  };
}

export async function getStaffOrganizationsAction() {
  await requireStaffAuth();
  const { data, error } = await supabaseAdmin.from('organizations').select('*').order('name');
  if (error) throw new Error('Failed to load organizations');
  return (data || []).map((row) => toMasterDataDto('organizations', row));
}

export async function getStaffDepartmentsAction() {
  await requireStaffAuth();
  const { data, error } = await supabaseAdmin.from('departments').select('*').order('name');
  if (error) throw new Error('Failed to load departments');
  return (data || []).map((row) => toMasterDataDto('departments', row));
}

export async function createMasterDataAction(value: unknown) {
  const { user } = await requireStaffAuth({ permission: 'settings_master', level: 'edit' });
  const input = parseMasterCreateInput(value);
  const { data, error } = await supabaseAdmin.from(input.table)
    .insert([input.payload]).select('*').single();
  if (error || !data) throw new Error('Failed to create master data');
  const dto = toMasterDataDto(input.tab, data);
  await writeMasterAudit(user.id, 'MASTER_CREATE', input.table, String(dto.id), input.payload);
  return dto;
}

export async function updateMasterDataAction(value: unknown) {
  const { user } = await requireStaffAuth({ permission: 'settings_master', level: 'edit' });
  const input = parseMasterUpdateInput(value);
  const { data, error } = await supabaseAdmin.from(input.table)
    .update(input.payload)
    .eq('id', input.id).select('*').single();
  if (error || !data) throw new Error('Failed to update master data');
  await writeMasterAudit(user.id, 'MASTER_UPDATE', input.table, input.id, input.payload);
  return toMasterDataDto(input.tab, data);
}

export async function toggleMasterDataAction(value: unknown) {
  const { user } = await requireStaffAuth({ permission: 'settings_master', level: 'edit' });
  const input = parseMasterToggleInput(value);
  const { data, error } = await supabaseAdmin.from(input.table)
    .update({ is_active: input.isActive })
    .eq('id', input.id).select('*').single();
  if (error || !data) throw new Error('Failed to toggle master data');
  await writeMasterAudit(user.id, 'MASTER_TOGGLE', input.table, input.id, { is_active: input.isActive });
  return toMasterDataDto(input.tab, data);
}
