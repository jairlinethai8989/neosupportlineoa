import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { analyticsService } from '@/lib/services/analyticsService';
import { sendLineGroupFlexNotification } from '@/lib/utils/lineNotifications';
import { getReportBroadcastSettings, type ReportScheduleRow, type ReportSet } from '@/lib/reports/broadcastSettings';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const DEFAULT_CRON_WINDOW_MINUTES = 10;
const recentCronSentKeys = new Set<string>();

function getCronWindowMinutes(): number {
  const parsed = Number(process.env.CRON_MATCH_WINDOW_MINUTES);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 60) {
    return Math.floor(parsed);
  }
  return DEFAULT_CRON_WINDOW_MINUTES;
}

function parseMinutesOfDay(hhmm: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isScheduleWithinWindow(row: ReportScheduleRow, now: DateTime, windowMinutes: number): boolean {
  if (!row.enabled) return false;
  const schedMinutes = parseMinutesOfDay(row.time);
  const nowMinutes = parseMinutesOfDay(now.toFormat('HH:mm'));
  if (schedMinutes === null || nowMinutes === null) return false;
  const diff = nowMinutes - schedMinutes;
  return diff >= 0 && diff < windowMinutes;
}

async function hasCronKeyBeenSent(cronKey: string): Promise<boolean> {
  if (recentCronSentKeys.has(cronKey)) return true;
  try {
    const { data, error } = await supabaseAdmin
      .from('system_logs')
      .select('id')
      .eq('action_type', 'cron_daily_summary')
      .eq('entity_id', cronKey)
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      recentCronSentKeys.add(cronKey);
      return true;
    }
  } catch (err) {
    console.warn('Cron idempotency DB check skipped:', err);
  }
  return false;
}

async function recordCronKeySent(cronKey: string, set: ReportSet, groupId: string): Promise<void> {
  recentCronSentKeys.add(cronKey);
  if (recentCronSentKeys.size > 200) {
    const oldest = recentCronSentKeys.values().next().value;
    if (oldest) recentCronSentKeys.delete(oldest);
  }
  try {
    await supabaseAdmin.from('system_logs').insert([
      {
        action_type: 'cron_daily_summary',
        entity_type: 'report_broadcast',
        entity_id: cronKey,
        note: `Daily summary set ${set} sent to LINE group ${groupId}`,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (err) {
    console.warn('Cron idempotency DB log skipped:', err);
  }
}

type DetailTicket = {
  subject: string;
  status: string | null;
  organizations?: { name?: string | null } | null;
};

function parseDate(ymd: string | null): DateTime | null {
  if (!ymd) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return DateTime.fromISO(ymd, { zone: 'Asia/Bangkok' });
}

function getRangeByDate(date: DateTime) {
  const base = date.toFormat('yyyy-MM-dd');
  const start = DateTime.fromISO(`${base}T00:00:00`, { zone: 'Asia/Bangkok' });
  const end = DateTime.fromISO(`${base}T23:59:59`, { zone: 'Asia/Bangkok' });
  return {
    startDateStr: start.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ"),
    endDateStr: end.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ"),
    dateLabel: date.toFormat('dd/MM/yyyy'),
  };
}

async function sendSetOne(targetGroupId: string, dateLabel: string, startDateStr: string, endDateStr: string) {
  const stats = await analyticsService.getSummaryStats(startDateStr, endDateStr);
  const card = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: `Daily KPI (${dateLabel})`, weight: 'bold', size: 'lg' },
        { type: 'separator', margin: 'md' },
        { type: 'text', text: `All open: ${stats.total}`, margin: 'md' },
        { type: 'text', text: `New: ${stats.new}` },
        { type: 'text', text: `Resolved: ${stats.resolved}` },
        { type: 'text', text: `SLA breached: ${stats.breached}` },
      ],
    },
  };
  await sendLineGroupFlexNotification(`Daily KPI (${dateLabel})`, card, targetGroupId);
  return stats;
}

async function sendSetTwo(targetGroupId: string, dateLabel: string, startDateStr: string, endDateStr: string) {
  const details = await analyticsService.getDetailedSummary(startDateStr, endDateStr);
  if (!details.length) return { details };

  const grouped: Record<string, DetailTicket[]> = {};
  (details as DetailTicket[]).forEach((item) => {
    const organization = item.organizations?.name || 'Unspecified organization';
    if (!grouped[organization]) grouped[organization] = [];
    grouped[organization].push(item);
  });

  const contents: Array<Record<string, unknown>> = [
    { type: 'text', text: `Mission Logs (${dateLabel})`, weight: 'bold', size: 'lg' },
    { type: 'separator', margin: 'md' },
  ];

  Object.entries(grouped).forEach(([organization, tickets]) => {
    contents.push({ type: 'text', text: `${organization} (${tickets.length})`, margin: 'md', weight: 'bold', size: 'sm' });
    tickets.slice(0, 15).forEach((ticket) => {
      contents.push({
        type: 'text',
        text: `• ${ticket.subject}`,
        size: 'xs',
        wrap: true,
        margin: 'sm',
      });
    });
  });

  const card = { type: 'bubble', size: 'mega', body: { type: 'box', layout: 'vertical', contents } };
  await sendLineGroupFlexNotification(`Mission Logs (${dateLabel})`, card, targetGroupId);
  return { details };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return NextResponse.json({ error: 'System not configured for cron' }, { status: 500 });
  if (key !== cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const now = DateTime.now().setZone('Asia/Bangkok');
    const requestedSet = searchParams.get('set');
    const requestedDate = parseDate(searchParams.get('date'));

    const settings = await getReportBroadcastSettings();
    if (!settings.groupId) {
      return NextResponse.json({ success: false, skipped: true, reason: 'No target LINE group configured.' });
    }

    const targetDate = requestedDate || now;
    const targetDateIso = targetDate.toISODate() || targetDate.toFormat('yyyy-MM-dd');
    const { startDateStr, endDateStr, dateLabel } = getRangeByDate(targetDate);

    let setsToSend: ReportSet[] = [];
    const matchedAutoRows: Array<{ cronKey: string; set: ReportSet }> = [];

    if (requestedSet === '1' || requestedSet === '2') {
      setsToSend = [requestedSet];
    } else {
      if (settings.mode !== 'auto') {
        return NextResponse.json({ success: true, skipped: true, reason: 'Manual mode is enabled.' });
      }
      const hhmm = now.toFormat('HH:mm');
      const windowMinutes = getCronWindowMinutes();
      const activeRows = settings.schedules.filter((row) =>
        isScheduleWithinWindow(row, now, windowMinutes)
      );
      if (!activeRows.length) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: `No schedule matched within ${windowMinutes}m window at ${hhmm}.`,
        });
      }

      for (const row of activeRows) {
        const cronKey = `${targetDateIso}:${row.time}:set-${row.set}`;
        const alreadySent = await hasCronKeyBeenSent(cronKey);
        if (!alreadySent) {
          matchedAutoRows.push({ cronKey, set: row.set });
        }
      }

      if (!matchedAutoRows.length) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: `Matched schedule(s) at ${hhmm} were already sent for ${targetDateIso}.`,
        });
      }
      setsToSend = [...new Set(matchedAutoRows.map((row) => row.set))];
    }

    let stats: unknown = null;
    let detailCount = 0;
    if (setsToSend.includes('1')) {
      stats = await sendSetOne(settings.groupId, dateLabel, startDateStr, endDateStr);
      for (const row of matchedAutoRows.filter((r) => r.set === '1')) {
        await recordCronKeySent(row.cronKey, '1', settings.groupId);
      }
    }
    if (setsToSend.includes('2')) {
      const details = await sendSetTwo(settings.groupId, dateLabel, startDateStr, endDateStr);
      detailCount = (details.details || []).length;
      for (const row of matchedAutoRows.filter((r) => r.set === '2')) {
        await recordCronKeySent(row.cronKey, '2', settings.groupId);
      }
    }

    return NextResponse.json({
      success: true,
      mode: settings.mode,
      sets: setsToSend,
      groupId: settings.groupId,
      date: targetDate.toISODate(),
      stats,
      detailCount,
    });
  } catch (error: unknown) {
    console.error('Daily summary cron error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
