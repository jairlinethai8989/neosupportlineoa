'use server';

import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import {
  getGeminiKeyStatus,
  parseBrandingSettingsInput,
  parseGeminiApiKey,
  parseGoogleSheetsUrl,
  toClientCompanySettings,
} from '@/lib/settings/companySettingsSecurity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function readCompanySettingsRow(select: string) {
  const { data, error } = await supabaseAdmin
    .from('company_settings')
    .select(select)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error('Failed to load company settings');
  return data as Record<string, unknown> | null;
}

export async function getClientCompanySettingsAction() {
  await requireStaffAuth();
  const row = await readCompanySettingsRow('*');
  return toClientCompanySettings(row);
}

export async function getGeminiKeyStatusAction() {
  await requireStaffAuth({ permission: 'settings_master', level: 'view' });
  const row = await readCompanySettingsRow('gemini_api_key');
  return getGeminiKeyStatus(row);
}

export async function saveGeminiApiKeyAction(value: unknown) {
  await requireStaffAuth({ permission: 'settings_master', level: 'edit' });
  const apiKey = parseGeminiApiKey(value);
  const row = await readCompanySettingsRow('id');
  if (!row?.id) throw new Error('Company settings are not configured');

  const { error } = await supabaseAdmin
    .from('company_settings')
    .update({ gemini_api_key: apiKey, updated_at: new Date().toISOString() })
    .eq('id', row.id);
  if (error) throw new Error('Failed to save Gemini API key');

  return { success: true } as const;
}

export async function saveGoogleSheetsUrlAction(value: unknown) {
  const staff = await requireStaffAuth({ permission: 'settings_master', level: 'edit' });
  const googleSheetsUrl = parseGoogleSheetsUrl(value);
  const row = await readCompanySettingsRow('id');
  if (!row?.id) throw new Error('Company settings are not configured');

  const updatedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('company_settings')
    .update({ google_sheets_url: googleSheetsUrl, updated_at: updatedAt })
    .eq('id', row.id);

  if (error?.code === '42703') {
    return { success: false, error: 'column_missing' } as const;
  }
  if (error) throw new Error('Failed to save Google Sheets URL');

  await supabaseAdmin.from('system_logs').insert([{
    performer_id: staff.user.id,
    action_type: 'GOOGLE_SHEETS_URL_UPDATE',
    entity_type: 'COMPANY',
    entity_id: String(row.id),
    new_data: { configured: Boolean(googleSheetsUrl) },
    note: googleSheetsUrl
      ? 'Updated Google Sheets integration endpoint'
      : 'Disconnected Google Sheets integration endpoint',
    created_at: updatedAt,
  }]);

  return { success: true } as const;
}

export async function saveBrandingSettingsAction(value: unknown) {
  const staff = await requireStaffAuth({ permission: 'settings_branding', level: 'edit' });
  const input = parseBrandingSettingsInput(value);
  const row = await readCompanySettingsRow('id');

  if (row?.id) {
    const { error } = await supabaseAdmin
      .from('company_settings')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) throw new Error('Failed to save branding settings');
  } else {
    const { error } = await supabaseAdmin.from('company_settings').insert([input]);
    if (error) throw new Error('Failed to create branding settings');
  }

  await supabaseAdmin.from('system_logs').insert([{
    performer_id: staff.user.id,
    action_type: 'BRANDING_UPDATE',
    entity_type: 'COMPANY',
    entity_id: row?.id ? String(row.id) : undefined,
    new_data: input,
    note: 'Updated corporate branding and active threshold settings',
    created_at: new Date().toISOString(),
  }]);

  return getClientCompanySettingsAction();
}
