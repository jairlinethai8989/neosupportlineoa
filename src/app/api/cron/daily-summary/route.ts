import { NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analyticsService';
import { sendLineGroupFlexNotification } from '@/lib/utils/lineNotifications';
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

type DetailTicket = {
  subject: string;
  status: string | null;
  hospitals?: { name?: string | null } | null;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'System not configured for cron' }, { status: 500 });
  }

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
    const thaiDayOfMonth = start.toFormat('d');
    const thaiMonthName = THAI_MONTHS[Number(start.toFormat('M')) - 1];
    const thaiBuddhistYear = Number(start.toFormat('yyyy')) + 543;
    const fullDateStr = `${THAI_DAYS[dayNameEn] || dayNameEn}ที่ ${thaiDayOfMonth} ${thaiMonthName} พ.ศ. ${thaiBuddhistYear}`;
    const timeRangeStr = `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')} น.`;
    const titlePrefix = reportType === 'Morning' ? '🌅 สรุปงานกะดึก' : '🌆 สรุปงานประจำวัน';

    // --- MESSAGE 1: KPI SUMMARY (GOLDEN PREMIUM THEME) ---
    const kpiFlex = {
      "type": "bubble", "size": "mega",
      "header": { "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": titlePrefix, "weight": "bold", "size": "xl", "color": "#ffffff" }, { "type": "text", "text": fullDateStr, "size": "sm", "color": "#ffffff", "margin": "sm", "weight": "bold" }, { "type": "text", "text": `ช่วงเวลา: ${timeRangeStr}`, "size": "xs", "color": "#ffffff", "margin": "xs" }], "backgroundColor": themeColor, "paddingAll": "20px" },
      "body": { "type": "box", "layout": "vertical", "contents": [
        { "type": "box", "layout": "horizontal", "contents": [
          { "type": "box", "layout": "vertical", "contents": [
            { "type": "text", "text": "🆕 งานใหม่", "size": "sm", "color": "#8c9196" },
            { "type": "text", "text": stats.new.toString(), "weight": "bold", "size": "xxl", "margin": "sm", "color": themeColor }
          ] }
        ]},
        { "type": "separator", "margin": "xl" },
        { "type": "box", "layout": "vertical", "contents": [
          { "type": "box", "layout": "horizontal", "contents": [
            { "type": "text", "text": "📦 งานรอดำเนินการ", "size": "sm", "color": "#555555", "flex": 4 },
            { "type": "text", "text": stats.total.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2 }
          ], "margin": "md" },
          { "type": "box", "layout": "horizontal", "contents": [
            { "type": "text", "text": "✅ ปิดงานแล้ว (รวม)", "size": "sm", "color": "#28c76f", "flex": 4 },
            { "type": "text", "text": stats.resolved.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#28c76f" }
          ], "margin": "md" },
          { "type": "box", "layout": "horizontal", "contents": [
            { "type": "text", "text": "🚨 เกิน SLA", "size": "sm", "color": "#ea5455", "flex": 4 },
            { "type": "text", "text": stats.breached.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#ea5455" }
          ], "margin": "md" }
        ], "margin": "xl" }
      ], "paddingAll": "20px" },
      "footer": { "type": "box", "layout": "vertical", "contents": [{ "type": "button", "action": { "type": "uri", "label": "เปิดหน้า Dashboard", "uri": process.env.NEXT_PUBLIC_BASE_URL || "https://neoworkspace.vercel.app" }, "style": "primary", "color": themeColor }], "paddingAll": "10px" }
    };

    const targetSet = searchParams.get('set');
    const summaryGroupId = process.env.LINE_GROUP_ID_SUMMARY;

    // Fetch target groups from database
    let activeGroupIds: string[] = [];
    try {
      const { data: groups } = await supabaseAdmin
        .from('line_groups')
        .select('group_id')
        .eq('is_active', true);
      
      if (groups && groups.length > 0) {
        activeGroupIds = groups.map((g) => g.group_id);
      }
    } catch (e) {
      console.error('Failed to fetch line groups:', e);
    }

    // --- EXECUTE ONLY REQUESTED SET OR ALL ---
    
    // [SET 1] KPI SUMMARY
    if (!targetSet || targetSet === '1') {
      if (activeGroupIds.length > 0) {
        for (const gid of activeGroupIds) {
          await sendLineGroupFlexNotification(`📊 รายงานสรุป KPI (${start.toFormat('dd/MM')})`, kpiFlex, gid);
          await new Promise(r => setTimeout(r, 600));
        }
      } else {
        await sendLineGroupFlexNotification(`📊 รายงานสรุป KPI (${start.toFormat('dd/MM')})`, kpiFlex);
      }
      
      if (summaryGroupId && !activeGroupIds.includes(summaryGroupId)) {
        await new Promise(r => setTimeout(r, 600));
        await sendLineGroupFlexNotification(`📊 รายงานสรุป KPI (Executive)`, kpiFlex, summaryGroupId);
      }
    }

    // [SET 2] DETAILED SUMMARY
    if (!targetSet || targetSet === '2') {
      if (details && details.length > 0) {
        const grouped: Record<string, DetailTicket[]> = {};
        (details as DetailTicket[]).forEach((t) => {
          const hName = t.hospitals?.name || 'ไม่ระบุโรงพยาบาล';
          if (!grouped[hName]) grouped[hName] = [];
          grouped[hName].push(t);
        });

        const hospitalEntries = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
        let currentChunkTickets = 0;
        let currentChunkContents: unknown[] = [];
        let bubbleIndex = 1;

        const sendChunk = async (contents: unknown[]) => {
          const detailFlex = {
            "type": "bubble", "size": "mega",
            "body": { "type": "box", "layout": "vertical", "contents": contents, "paddingAll": "20px", "backgroundColor": "#262626" }
          };
          
          if (activeGroupIds.length > 0) {
            for (const gid of activeGroupIds) {
              await sendLineGroupFlexNotification(`📋 รายละเอียดงานชุดที่ ${bubbleIndex}`, detailFlex, gid);
              await new Promise(r => setTimeout(r, 600));
            }
          } else {
            await sendLineGroupFlexNotification(`📋 รายละเอียดงานชุดที่ ${bubbleIndex}`, detailFlex);
          }
          
          if (summaryGroupId && !activeGroupIds.includes(summaryGroupId)) {
            await new Promise(r => setTimeout(r, 600));
            await sendLineGroupFlexNotification(`📋 รายละเอียดงานชุดที่ ${bubbleIndex}`, detailFlex, summaryGroupId);
          }
          bubbleIndex++;
        };

        for (const [hName, tickets] of hospitalEntries) {
          // Chunk limit increased to 20 tickets as requested
          if (currentChunkTickets > 0 && (currentChunkTickets + tickets.length > 20)) {
            await sendChunk(currentChunkContents);
            currentChunkContents = [];
            currentChunkTickets = 0;
            await new Promise(r => setTimeout(r, 1000));
          }

          if (currentChunkContents.length === 0) {
            currentChunkContents.push({ "type": "text", "text": `🛸 MISSION LOG: ชุดที่ ${bubbleIndex}`, "weight": "bold", "size": "sm", "color": "#00F2FE" });
          }

          const hospitalBox: unknown[] = [
            { "type": "separator", "margin": "md", "color": "#444444" },
            { "type": "text", "text": `🏥 ${hName} (${tickets.length})`, "weight": "bold", "size": "xs", "margin": "md", "color": "#00F2FE" }
          ];

          tickets.forEach(t => {
            hospitalBox.push({
              "type": "box", "layout": "horizontal", "margin": "sm",
              "contents": [
                { "type": "text", "text": `• ${t.subject}`, "size": "xs", "color": "#FFFFFF", "flex": 5, "wrap": true },
                { "type": "text", "text": t.status === 'Resolved' ? "✅" : "⏳", "size": "xs", "flex": 1, "align": "end" }
              ]
            });
          });

          currentChunkContents.push({ "type": "box", "layout": "vertical", "contents": hospitalBox, "margin": "md" });
          currentChunkTickets += tickets.length;
        }

        if (currentChunkContents.length > 0) {
          await sendChunk(currentChunkContents);
        }
      }
    }

    return NextResponse.json({ success: true, stats, detailCount: details.length });

  } catch (error: unknown) {
    console.error('Daily Summary Cron Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
