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

    // --- MESSAGE 1: KPI SUMMARY ---
    const statusRows: any[] = [
      { "type": "box", "layout": "horizontal", "contents": [{ "type": "text", "text": "📦 งานรอดำเนินการ", "size": "sm", "color": "#555555", "flex": 4 }, { "type": "text", "text": stats.total.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2 }], "margin": "md" },
      { "type": "box", "layout": "horizontal", "contents": [{ "type": "text", "text": "✅ ปิดงานแล้ว (รวม)", "size": "sm", "color": "#28c76f", "flex": 4 }, { "type": "text", "text": stats.resolved.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#28c76f" }], "margin": "md" }
    ];
    if (stats.inProgress > 0) statusRows.push({ "type": "box", "layout": "horizontal", "contents": [{ "type": "text", "text": "🔄 กำลังแก้ไข", "size": "sm", "color": "#7367f0", "flex": 4 }, { "type": "text", "text": stats.inProgress.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#7367f0" }], "margin": "md" });
    if (stats.transferred > 0) statusRows.push({ "type": "box", "layout": "horizontal", "contents": [{ "type": "text", "text": "↪️ งานที่ส่งต่อ", "size": "sm", "color": "#ff9f43", "flex": 4 }, { "type": "text", "text": stats.transferred.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#ff9f43" }], "margin": "md" });
    statusRows.push({ "type": "box", "layout": "horizontal", "contents": [{ "type": "text", "text": "🚨 เกิน SLA", "size": "sm", "color": "#ea5455", "flex": 4 }, { "type": "text", "text": stats.breached.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#ea5455" }], "margin": "md" });

    const kpiFlex = {
      "type": "bubble", "size": "mega",
      "header": { "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": titlePrefix, "weight": "bold", "size": "xl", "color": "#ffffff" }, { "type": "text", "text": fullDateStr, "size": "sm", "color": "#ffffff", "margin": "sm", "weight": "bold" }, { "type": "text", "text": `ช่วงเวลา: ${timeRangeStr}`, "size": "xs", "color": "#ffffff", "margin": "xs" }], "backgroundColor": themeColor, "paddingAll": "20px" },
      "body": { "type": "box", "layout": "vertical", "contents": [{ "type": "box", "layout": "horizontal", "contents": [{ "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": "🆕 งานใหม่", "size": "sm", "color": "#8c9196" }, { "type": "text", "text": stats.new.toString(), "weight": "bold", "size": "xxl", "margin": "sm", "color": themeColor }] }] }, { "type": "separator", "margin": "xl" }, { "type": "box", "layout": "vertical", "contents": statusRows, "margin": "xl" }], "paddingAll": "20px" },
      "footer": { "type": "box", "layout": "vertical", "contents": [{ "type": "button", "action": { "type": "uri", "label": "เปิดหน้า Dashboard", "uri": process.env.NEXT_PUBLIC_BASE_URL || "https://neoworkspace.vercel.app" }, "style": "primary", "color": themeColor }], "paddingAll": "10px" }
    };

    // --- SEND KPI SUMMARY FIRST ---
    await sendLineGroupFlexNotification(`📊 รายงานสรุปชุดที่ 1 (${start.toFormat('dd/MM')})`, kpiFlex);
    const summaryGroupId = process.env.LINE_GROUP_ID_SUMMARY;
    if (summaryGroupId) {
      await new Promise(r => setTimeout(r, 500));
      await sendLineGroupFlexNotification(`📊 รายงานสรุปประจำวัน (กลุ่มสรุปงาน)`, kpiFlex, summaryGroupId);
    }
    await new Promise(r => setTimeout(r, 800));

    // --- MESSAGE 2+: ACTIVITY DETAILS (SPLIT TO PREVENT LINE SIZE LIMIT) ---
    if (details.length === 0) {
      const emptyFlex = {
        "type": "bubble", "size": "mega",
        "body": { "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": "📋 รายละเอียดแยกตามโรงพยาบาล", "weight": "bold", "size": "md", "color": themeColor }, { "type": "text", "text": "ไม่มีข้อมูลงานใหม่ในช่วงเวลานี้", "size": "sm", "color": "#8c9196", "margin": "md" }], "paddingAll": "20px" }
      };
      await sendLineGroupFlexNotification(`📋 รายละเอียดงานแยกโรงพยาบาล`, emptyFlex);
      
      const summaryGroupId = process.env.LINE_GROUP_ID_SUMMARY;
      if (summaryGroupId) {
        await sendLineGroupFlexNotification(`📋 รายละเอียดงานแยกโรงพยาบาล`, emptyFlex, summaryGroupId);
      }
    } else {
      // Group by Hospital
      const grouped: Record<string, any[]> = {};
      details.forEach((t: any) => {
        const hName = t.hospitals?.name || 'ไม่ระบุโรงพยาบาล';
        if (!grouped[hName]) grouped[hName] = [];
        grouped[hName].push(t);
      });

      // Prepare chunks of hospitals to prevent oversized bubbles
      const hospitalEntries = Object.entries(grouped);
      const CHUNK_SIZE = 2; // VERY SMALL CHUNK for safety
      let lastError = null;
      
      for (let i = 0; i < hospitalEntries.length; i += CHUNK_SIZE) {
        const chunk = hospitalEntries.slice(i, i + CHUNK_SIZE);
        const detailContents: any[] = [
          { "type": "text", "text": `📋 รายละเอียดงาน (${i + 1}-${Math.min(i + CHUNK_SIZE, hospitalEntries.length)})`, "weight": "bold", "size": "md", "color": themeColor }
        ];

        chunk.forEach(([hName, tickets]) => {
          detailContents.push({ "type": "separator", "margin": "md" });
          detailContents.push({ "type": "text", "text": `🏥 ${hName}`, "weight": "bold", "size": "xs", "margin": "sm", "color": "#333333" });
          
          tickets.forEach(t => {
            detailContents.push({
              "type": "box", "layout": "horizontal", "margin": "xs",
              "contents": [
                { "type": "text", "text": `• ${t.subject}`, "size": "xxs", "color": "#555555", "flex": 4, "wrap": true },
                { "type": "text", "text": t.status === 'Resolved' ? "✅" : "⏳", "size": "xxs", "flex": 1, "align": "end" }
              ]
            });
          });
        });

        const detailFlex = {
          "type": "bubble", "size": "mega",
          "body": { "type": "box", "layout": "vertical", "contents": detailContents, "paddingAll": "15px" }
        };

        try {
          // Send to Main Group
          await sendLineGroupFlexNotification(`📋 รายละเอียดงานชุดที่ ${i/CHUNK_SIZE + 1}`, detailFlex);
          
          // Send to Summary Group
          const summaryGroupId = process.env.LINE_GROUP_ID_SUMMARY;
          if (summaryGroupId) {
             await new Promise(r => setTimeout(r, 600));
             await sendLineGroupFlexNotification(`📋 รายละเอียดงานชุดที่ ${i/CHUNK_SIZE + 1}`, detailFlex, summaryGroupId);
          }
        } catch (e: any) {
          lastError = e.message;
        }

        await new Promise(r => setTimeout(r, 1000)); // More delay between chunks
      }

      if (lastError) {
        return NextResponse.json({ success: true, stats, detailCount: details.length, lineError: lastError });
      }
    }

    return NextResponse.json({ success: true, stats, detailCount: details.length });

  } catch (error: any) {
    console.error('Daily Summary Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
