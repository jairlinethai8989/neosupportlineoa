import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analyticsService';
import { sendLineGroupFlexNotification } from '@/lib/utils/lineNotifications';
import { DateTime } from 'luxon';

/**
 * Enhanced API Cron: Daily Summary Notification with Multiple Message Sets
 */

const DAY_COLORS: Record<string, string> = {
  'Sunday': '#D32F2F', 'Monday': '#FBC02D', 'Tuesday': '#F06292',
  'Wednesday': '#388E3C', 'Thursday': '#F57C00', 'Friday': '#1976D2', 'Saturday': '#7B1FA2'
};

const THAI_DAYS: Record<string, string> = {
  'Sunday': 'วันอาทิตย์', 'Monday': 'วันจันทร์', 'Tuesday': 'วันอังคาร',
  'Wednesday': 'วันพุธ', 'Thursday': 'วันพฤหัสบดี', 'Friday': 'วันศุกร์', 'Saturday': 'วันเสาร์'
};

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET || 'NEO_CRON_2026';

  if (key !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tz = 'Asia/Bangkok';
    const now = DateTime.now().setZone(tz);
    
    let reportType: 'Morning' | 'Evening' = 'Evening';
    let start: DateTime;
    let end: DateTime = now;

    if (now.hour < 12) {
      reportType = 'Morning';
      start = now.minus({ days: 1 }).set({ hour: 17, minute: 30, second: 0, millisecond: 0 });
      end = now.set({ hour: 8, minute: 30, second: 0, millisecond: 0 });
    } else {
      reportType = 'Evening';
      start = now.set({ hour: 8, minute: 30, second: 0, millisecond: 0 });
      // Use current time as end, but at least 17:30 to include the full day
      end = now; 
    }

    const startDateStr = start.toFormat('yyyy-MM-dd\'T\'HH:mm:ssZZ');
    const endDateStr = end.toFormat('yyyy-MM-dd\'T\'HH:mm:ssZZ');

    const stats = await analyticsService.getSummaryStats(startDateStr, endDateStr);
    const details = await analyticsService.getDetailedSummary(startDateStr, endDateStr);

    // Thai Formatting
    const dayNameEn = start.toFormat('EEEE');
    const themeColor = DAY_COLORS[dayNameEn] || '#4fc3f7';
    const fullDateStr = `${THAI_DAYS[dayNameEn] || dayNameEn}ที่ ${start.day} ${THAI_MONTHS[start.month - 1]} พ.ศ. ${start.year + 543}`;
    const timeRangeStr = `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')} น.`;
    const titlePrefix = reportType === 'Morning' ? '🌅 สรุปงานกะดึก' : '🌆 สรุปงานประจำวัน';

    // --- MESSAGE 1: KPI SUMMARY (FUTURE 2026 THEME) ---
    const kpiFlex = {
      "type": "bubble", "size": "mega",
      "header": { "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": titlePrefix, "weight": "bold", "size": "xl", "color": "#00F2FE", "letterSpacing": "md" }, { "type": "text", "text": fullDateStr, "size": "sm", "color": "#E0E0E0", "margin": "sm", "weight": "bold" }, { "type": "text", "text": `⏱️ Active Window: ${timeRangeStr}`, "size": "xs", "color": "#BDBDBD", "margin": "xs" }], "backgroundColor": "#1A1A1A", "paddingAll": "25px" },
      "body": { "type": "box", "layout": "vertical", "contents": [
        { "type": "box", "layout": "horizontal", "contents": [
          { "type": "box", "layout": "vertical", "contents": [
            { "type": "text", "text": "NEW MISSION", "size": "xxs", "color": "#00F2FE", "weight": "bold" },
            { "type": "text", "text": stats.new.toString(), "weight": "bold", "size": "4xl", "color": "#FFFFFF", "margin": "sm" }
          ], "flex": 3 },
          { "type": "box", "layout": "vertical", "contents": [
            { "type": "text", "text": "RESOLVED", "size": "xxs", "color": "#28C76F", "weight": "bold", "align": "end" },
            { "type": "text", "text": stats.resolved.toString(), "weight": "bold", "size": "xxl", "color": "#28C76F", "margin": "sm", "align": "end" }
          ], "flex": 2, "justifyContent": "center" }
        ]},
        { "type": "separator", "margin": "xl", "color": "#333333" },
        { "type": "box", "layout": "vertical", "contents": [
          { "type": "box", "layout": "horizontal", "contents": [
            { "type": "text", "text": "📦 PENDING TASKS", "size": "xs", "color": "#FBC02D", "flex": 4 },
            { "type": "text", "text": stats.total.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#FFFFFF" }
          ], "margin": "lg" },
          { "type": "box", "layout": "horizontal", "contents": [
            { "type": "text", "text": "🔄 IN REPAIR", "size": "xs", "color": "#BDBDBD", "flex": 4 },
            { "type": "text", "text": stats.inProgress.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#FFFFFF" }
          ], "margin": "md" },
          { "type": "box", "layout": "horizontal", "contents": [
            { "type": "text", "text": "🚨 SLA BREACH", "size": "xs", "color": "#EA5455", "flex": 4 },
            { "type": "text", "text": stats.breached.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#EA5455" }
          ], "margin": "md" }
        ], "margin": "xl" }
      ], "backgroundColor": "#262626", "paddingAll": "25px" },
      "footer": { "type": "box", "layout": "vertical", "contents": [{ "type": "button", "action": { "type": "uri", "label": "ACCESS CONTROL CENTER", "uri": process.env.NEXT_PUBLIC_BASE_URL || "https://neoworkspace.vercel.app" }, "style": "primary", "color": "#00F2FE", "height": "sm" }], "backgroundColor": "#1A1A1A", "paddingAll": "15px" }
    };

    // --- SEND KPI SUMMARY ---
    await sendLineGroupFlexNotification(`📊 Reports: ${start.toFormat('dd/MM')}`, kpiFlex);
    const summaryGroupId = process.env.LINE_GROUP_ID_SUMMARY;
    if (summaryGroupId) {
      await new Promise(r => setTimeout(r, 600));
      await sendLineGroupFlexNotification(`📊 Reports: Executive View`, kpiFlex, summaryGroupId);
    }
    await new Promise(r => setTimeout(r, 1000));

    // --- MESSAGE 2+: ACTIVITY DETAILS (10 TICKETS PER CHUNK) ---
    if (details.length === 0) {
      // (Empty skip or send simple text)
    } else {
      const TICKETS_PER_CHUNK = 10;
      for (let i = 0; i < details.length; i += TICKETS_PER_CHUNK) {
        const chunk = details.slice(i, i + TICKETS_PER_CHUNK);
        const detailContents: any[] = [
          { "type": "text", "text": `🛸 MISSION DETAILS (${i + 1}-${Math.min(i + TICKETS_PER_CHUNK, details.length)})`, "weight": "bold", "size": "sm", "color": "#00F2FE" }
        ];

        chunk.forEach((t: any) => {
          detailContents.push({ "type": "separator", "margin": "md", "color": "#333333" });
          detailContents.push({
            "type": "box", "layout": "vertical", "margin": "md",
            "contents": [
              { "type": "text", "text": `🏥 ${t.hospitals?.name || '-'}`, "size": "xxs", "color": "#BDBDBD" },
              { "type": "box", "layout": "horizontal", "contents": [
                { "type": "text", "text": t.subject, "size": "xs", "color": "#FFFFFF", "flex": 5, "wrap": true },
                { "type": "text", "text": t.status === 'Resolved' ? "✅" : "⏳", "size": "sm", "flex": 1, "align": "end" }
              ], "margin": "xs" }
            ]
          });
        });

        const detailFlex = {
          "type": "bubble", "size": "mega",
          "body": { "type": "box", "layout": "vertical", "contents": detailContents, "paddingAll": "20px", "backgroundColor": "#262626" }
        };

        await sendLineGroupFlexNotification(`📋 Data Stream ${i/TICKETS_PER_CHUNK + 1}`, detailFlex);
        if (summaryGroupId) {
          await new Promise(r => setTimeout(r, 600));
          await sendLineGroupFlexNotification(`📋 Data Stream ${i/TICKETS_PER_CHUNK + 1}`, detailFlex, summaryGroupId);
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return NextResponse.json({ success: true, stats, detailCount: details.length });

  } catch (error: any) {
    console.error('Daily Summary Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
