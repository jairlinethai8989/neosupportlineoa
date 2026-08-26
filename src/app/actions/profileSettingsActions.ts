'use server';

import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  parseOwnProfileSettings,
  parseOwnProfileTemplateUpdate,
} from '@/lib/profiles/profileSettingsSecurity';
import { toOwnProfileDto, toStaffDirectoryDto } from '@/lib/profiles/profileReadSecurity';
import { toClientCompanySettings } from '@/lib/settings/companySettingsSecurity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const OWN_PROFILE_SELECT = `
  id, email, role, full_name, avatar_url, permissions, status, last_seen,
  department, landing_page, theme_color, signature_url, quick_replies,
  resolution_templates, auto_logout_minutes, notif_sound_enabled,
  notif_sound_mode, notif_sound_voice, notif_event_new_ticket,
  notif_event_new_message, notif_event_transfer, notif_event_sla_warning
`;

async function readOwnProfile(staffId: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(OWN_PROFILE_SELECT)
    .eq('id', staffId)
    .maybeSingle();
  if (error || !data) throw new Error('Failed to load profile');
  return toOwnProfileDto(data as Record<string, unknown>);
}

export async function getOwnProfileAction() {
  const staff = await requireStaffAuth();
  return readOwnProfile(staff.user.id);
}

export async function getStaffBootstrapAction() {
  const staff = await requireStaffAuth();
  const [profile, settingsResult, modules, issueTypes, subjectTypes] = await Promise.all([
    readOwnProfile(staff.user.id),
    supabaseAdmin.from('company_settings').select('*').limit(1).maybeSingle(),
    supabaseAdmin.from('ticket_modules').select('name').eq('is_active', true).order('name'),
    supabaseAdmin.from('ticket_issue_types').select('name').eq('is_active', true).order('name'),
    supabaseAdmin.from('ticket_subject_types').select('name').eq('is_active', true).order('name'),
  ]);

  if (settingsResult.error || modules.error || issueTypes.error || subjectTypes.error) {
    throw new Error('Failed to load staff bootstrap data');
  }

  const names = (rows: Array<{ name?: unknown }> | null) => (rows || [])
    .map((row) => typeof row.name === 'string' ? row.name : '')
    .filter(Boolean);

  return {
    profile,
    companySettings: toClientCompanySettings(settingsResult.data as Record<string, unknown> | null),
    ticketOptions: {
      modules: names(modules.data),
      issueTypes: names(issueTypes.data),
      subjectTypes: names(subjectTypes.data),
    },
  };
}

export async function getPostLoginDestinationAction() {
  const staff = await requireStaffAuth();
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role, landing_page')
    .eq('id', staff.user.id)
    .maybeSingle();
  if (error || !data) throw new Error('Failed to load login destination');
  if (data.landing_page === 'inbox') return '/inbox' as const;
  if (data.landing_page === 'dashboard') return '/' as const;
  return data.role === 'Agent' ? '/inbox' as const : '/' as const;
}

export async function getProfileSettingsDataAction() {
  const staff = await requireStaffAuth();
  const [profile, departmentsResult] = await Promise.all([
    readOwnProfile(staff.user.id),
    supabaseAdmin
      .from('departments')
      .select('name')
      .eq('is_active', true)
      .eq('dept_type', 'organization')
      .order('name'),
  ]);
  if (departmentsResult.error) throw new Error('Failed to load profile settings');
  return {
    profile,
    departments: (departmentsResult.data || [])
      .map((row) => typeof row.name === 'string' ? row.name : '')
      .filter(Boolean),
  };
}

export async function getStaffPresenceDirectoryAction() {
  await requireStaffAuth();
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, avatar_url, status, department')
    .in('role', ['Agent', 'Administrator']);
  if (error) throw new Error('Failed to load staff directory');
  return (data || []).map((row) => toStaffDirectoryDto(row as Record<string, unknown>));
}

async function applyOwnProfileUpdate(updates: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('update_own_staff_profile', {
    p_updates: updates,
  });
  if (error || data !== true) throw new Error('Failed to update profile');
}

export async function saveOwnProfileSettingsAction(value: unknown) {
  const staff = await requireStaffAuth();
  const input = parseOwnProfileSettings(value);
  await applyOwnProfileUpdate(input);

  await supabaseAdmin.from('system_logs').insert([{
    performer_id: staff.user.id,
    action_type: 'PROFILE_UPDATE',
    entity_type: 'PROFILE',
    entity_id: staff.user.id,
    new_data: {
      full_name: input.full_name,
      department: input.department,
      landing_page: input.landing_page,
      theme_color: input.theme_color,
      avatar_configured: Boolean(input.avatar_url),
      signature_configured: Boolean(input.signature_url),
      auto_logout_minutes: input.auto_logout_minutes,
    },
    note: 'Updated own profile information',
    created_at: new Date().toISOString(),
  }]);

  return { success: true } as const;
}

export async function saveOwnProfileTemplatesAction(typeValue: unknown, value: unknown) {
  const staff = await requireStaffAuth();
  const input = parseOwnProfileTemplateUpdate(typeValue, value);
  const field = input.type === 'quick' ? 'quick_replies' : 'resolution_templates';
  const { data: current, error: readError } = await supabaseAdmin
    .from('profiles')
    .select(field)
    .eq('id', staff.user.id)
    .maybeSingle();
  if (readError || !current) throw new Error('Failed to load profile templates');

  const currentRow = current as Record<string, unknown>;
  const previousValues = Array.isArray(currentRow[field]) ? currentRow[field] as unknown[] : [];
  await applyOwnProfileUpdate({ [field]: input.values });
  const action = input.values.length > previousValues.length
    ? 'TEMPLATE_ADD'
    : input.values.length < previousValues.length
      ? 'TEMPLATE_DELETE'
      : 'TEMPLATE_UPDATE';

  await supabaseAdmin.from('system_logs').insert([{
    performer_id: staff.user.id,
    action_type: action,
    entity_type: 'PROFILE_TEMPLATE',
    entity_id: staff.user.id,
    new_data: { type: input.type, count: input.values.length },
    note: `Updated own ${input.type === 'quick' ? 'quick replies' : 'resolution templates'}`,
    created_at: new Date().toISOString(),
  }]);

  return { success: true } as const;
}
