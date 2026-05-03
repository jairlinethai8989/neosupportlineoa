import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type ReportBroadcastMode = 'manual' | 'auto';
export type ReportSet = '1' | '2';

export interface ReportScheduleRow {
  id: string;
  time: string; // HH:mm
  set: ReportSet;
  enabled: boolean;
}

export interface ReportBroadcastSettings {
  mode: ReportBroadcastMode;
  groupId: string | null;
  schedules: ReportScheduleRow[];
}

const DEFAULT_SETTINGS: ReportBroadcastSettings = {
  mode: 'manual',
  groupId: null,
  schedules: [],
};

const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeSet(input: unknown): ReportSet {
  return input === '2' ? '2' : '1';
}

function normalizeSchedules(raw: unknown): ReportScheduleRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, idx) => {
      const item = row as Record<string, unknown>;
      const time = typeof item.time === 'string' && HHMM_PATTERN.test(item.time) ? item.time : '';
      if (!time) return null;
      return {
        id: typeof item.id === 'string' && item.id ? item.id : `row-${idx + 1}`,
        time,
        set: normalizeSet(item.set),
        enabled: item.enabled !== false,
      };
    })
    .filter((row): row is ReportScheduleRow => row !== null);
}

export function normalizeBroadcastSettings(raw: unknown): ReportBroadcastSettings {
  const data = (raw || {}) as Record<string, unknown>;
  return {
    mode: data.mode === 'auto' ? 'auto' : 'manual',
    groupId: typeof data.groupId === 'string' && data.groupId.trim() ? data.groupId.trim() : null,
    schedules: normalizeSchedules(data.schedules),
  };
}

async function ensureCompanySettingsRow() {
  const { data, error } = await supabaseAdmin
    .from('company_settings')
    .select('id, report_broadcast_mode, report_broadcast_group_id, report_broadcast_schedules')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('company_settings')
    .insert([{}])
    .select('id, report_broadcast_mode, report_broadcast_group_id, report_broadcast_schedules')
    .single();
  if (insertError) throw insertError;
  return inserted;
}

export async function getReportBroadcastSettings(): Promise<ReportBroadcastSettings> {
  const row = await ensureCompanySettingsRow();
  return normalizeBroadcastSettings({
    mode: row.report_broadcast_mode,
    groupId: row.report_broadcast_group_id,
    schedules: row.report_broadcast_schedules,
  });
}

export async function saveReportBroadcastSettings(input: ReportBroadcastSettings): Promise<void> {
  const row = await ensureCompanySettingsRow();
  const normalized = normalizeBroadcastSettings(input);
  const { error } = await supabaseAdmin
    .from('company_settings')
    .update({
      report_broadcast_mode: normalized.mode,
      report_broadcast_group_id: normalized.groupId,
      report_broadcast_schedules: normalized.schedules,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (error) throw error;
}

export function getDefaultReportBroadcastSettings(): ReportBroadcastSettings {
  return DEFAULT_SETTINGS;
}
