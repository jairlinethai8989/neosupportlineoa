export const CLIENT_COMPANY_SETTING_KEYS = [
  'id',
  'company_name',
  'logo_url',
  'departments',
  'modules',
  'issue_types',
  'resolution_templates',
  'report_tags',
  'active_threshold_minutes',
  'global_quick_replies',
  'global_resolution_templates',
  'google_sheets_url',
  'report_broadcast_mode',
  'report_broadcast_group_id',
  'report_broadcast_schedules',
  'updated_at',
] as const;

export type ClientCompanySettings = Partial<
  Record<(typeof CLIENT_COMPANY_SETTING_KEYS)[number], unknown>
>;

export function toClientCompanySettings(
  row: Record<string, unknown> | null | undefined
): ClientCompanySettings {
  if (!row) return {};

  const safe: ClientCompanySettings = {};
  for (const key of CLIENT_COMPANY_SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      safe[key] = row[key];
    }
  }
  return safe;
}

export function getGeminiKeyStatus(
  row: Record<string, unknown> | null | undefined
) {
  return {
    configured:
      typeof row?.gemini_api_key === 'string' && row.gemini_api_key.trim().length > 0,
  };
}

export function parseGeminiApiKey(value: unknown) {
  const key = String(value ?? '').trim();
  if (!/^[A-Za-z0-9_-]{20,512}$/.test(key)) {
    throw new Error('Invalid Gemini API key');
  }
  return key;
}

export function parseGoogleSheetsUrl(value: unknown) {
  const url = String(value ?? '').trim();
  if (!url) return null;
  return parseGoogleAppsScriptTargetUrl(url);
}

export function parseBrandingSettingsInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid branding settings');
  }

  const input = value as Record<string, unknown>;
  const companyName = String(input.company_name ?? '').trim();
  if (companyName.length < 1 || companyName.length > 160) {
    throw new Error('Invalid company name');
  }

  const logoUrl = input.logo_url === null || input.logo_url === undefined
    ? null
    : String(input.logo_url).trim();
  if (logoUrl && logoUrl.length > 2048) {
    throw new Error('Invalid logo URL');
  }

  const activeThreshold = Number(input.active_threshold_minutes ?? 15);
  if (![5, 10, 15].includes(activeThreshold)) {
    throw new Error('Invalid active threshold');
  }

  return {
    company_name: companyName,
    logo_url: logoUrl || null,
    active_threshold_minutes: activeThreshold,
  };
}
import { parseGoogleAppsScriptTargetUrl } from '@/lib/reports/googleAppsScriptUrl';
