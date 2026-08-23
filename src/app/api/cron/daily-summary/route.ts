import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { analyticsService } from '@/lib/services/analyticsService';
import { sendLineGroupFlexNotification } from '@/lib/utils/lineNotifications';
import { getReportBroadcastSettings, type ReportSet } from '@/lib/reports/broadcastSettings';
import { isAuthorizedCronRequest } from '@/lib/auth/cronAuthorization';
import { getStaffAuth } from '@/lib/auth/staffAuthorization';

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
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return NextResponse.json({ error: 'System not configured for cron' }, { status: 500 });
  if (!isAuthorizedCronRequest(req, cronSecret)) {
    const staff = await getStaffAuth({ permission: 'reports', level: 'edit' });
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const { searchParams } = new URL(req.url);
    const now = DateTime.now().setZone('Asia/Bangkok');
    const requestedSet = searchParams.get('set');
    const requestedDate = parseDate(searchParams.get('date'));

    const settings = await getReportBroadcastSettings();
    if (!settings.groupId) {
      return NextResponse.json({ success: false, skipped: true, reason: 'No target LINE group configured.' });
    }

    let setsToSend: ReportSet[] = [];
    if (requestedSet === '1' || requestedSet === '2') {
      setsToSend = [requestedSet];
    } else {
      if (settings.mode !== 'auto') {
        return NextResponse.json({ success: true, skipped: true, reason: 'Manual mode is enabled.' });
      }
      const hhmm = now.toFormat('HH:mm');
      const activeRows = settings.schedules.filter((row) => row.enabled && row.time === hhmm);
      if (!activeRows.length) {
        return NextResponse.json({ success: true, skipped: true, reason: `No schedule matched at ${hhmm}.` });
      }
      setsToSend = [...new Set(activeRows.map((row) => row.set))];
    }

    const targetDate = requestedDate || now;
    const { startDateStr, endDateStr, dateLabel } = getRangeByDate(targetDate);

    let stats: unknown = null;
    let detailCount = 0;
    if (setsToSend.includes('1')) {
      stats = await sendSetOne(settings.groupId, dateLabel, startDateStr, endDateStr);
    }
    if (setsToSend.includes('2')) {
      const details = await sendSetTwo(settings.groupId, dateLabel, startDateStr, endDateStr);
      detailCount = (details.details || []).length;
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
