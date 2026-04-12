import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analyticsService';
import { sendLineGroupFlexNotification } from '@/lib/utils/lineNotifications';
import { DateTime } from 'luxon';

/**
 * Enhanced API Cron: Daily Summary Notification with Thai Themes
 */

const DAY_COLORS: Record<string, string> = {
  'Sunday': '#D32F2F',    // Red
  'Monday': '#FBC02D',    // Yellow
  'Tuesday': '#F06292',   // Pink
  'Wednesday': '#388E3C', // Green
  'Thursday': '#F57C00',  // Orange
  'Friday': '#1976D2',    // Blue
  'Saturday': '#7B1FA2'   // Purple
};

const THAI_DAYS: Record<string, string> = {
  'Sunday': 'วันอาทิตย์',
  'Monday': 'วันจันทร์',
  'Tuesday': 'วันอังคาร',
  'Wednesday': 'วันพุธ',
  'Thursday': 'วันพฤหัสบดี',
  'Friday': 'วันศุกร์',
  'Saturday': 'วันเสาร์'
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
      end = now.set({ hour: 17, minute: 30, second: 0, millisecond: 0 });
    }

    const stats = await analyticsService.getSummaryStats(
      start.toFormat('yyyy-MM-dd\'T\'HH:mm:ssZZ'),
      end.toFormat('yyyy-MM-dd\'T\'HH:mm:ssZZ')
    );

    // Thai Formatting
    const dayNameEn = start.toFormat('EEEE');
    const thaiDayName = THAI_DAYS[dayNameEn] || dayNameEn;
    const themeColor = DAY_COLORS[dayNameEn] || '#4fc3f7';
    const thaiMonth = THAI_MONTHS[start.month - 1];
    const thaiYear = start.year + 543;
    const fullDateStr = `${thaiDayName}ที่ ${start.day} ${thaiMonth} พ.ศ. ${thaiYear}`;
    const timeRangeStr = `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')} น.`;

    const titlePrefix = reportType === 'Morning' ? '🌅 สรุปงานกะดึก' : '🌆 สรุปงานประจำวัน';

    // Build Status Rows dynamically
    const statusRows: any[] = [
      {
        "type": "box",
        "layout": "horizontal",
        "contents": [
          { "type": "text", "text": "📦 งานทั้งหมด", "size": "sm", "color": "#555555", "flex": 4 },
          { "type": "text", "text": stats.total.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2 }
        ],
        "margin": "md"
      },
      {
        "type": "box",
        "layout": "horizontal",
        "contents": [
          { "type": "text", "text": "✅ ปิดงานแล้ว", "size": "sm", "color": "#28c76f", "flex": 4 },
          { "type": "text", "text": stats.resolved.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#28c76f" }
        ],
        "margin": "md"
      }
    ];

    if (stats.inProgress > 0) {
      statusRows.push({
        "type": "box",
        "layout": "horizontal",
        "contents": [
          { "type": "text", "text": "🔄 กำลังดำเนินการ", "size": "sm", "color": "#7367f0", "flex": 4 },
          { "type": "text", "text": stats.inProgress.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#7367f0" }
        ],
        "margin": "md"
      });
    }

    if (stats.transferred > 0) {
      statusRows.push({
        "type": "box",
        "layout": "horizontal",
        "contents": [
          { "type": "text", "text": "↪️ งานที่ส่งต่อ", "size": "sm", "color": "#ff9f43", "flex": 4 },
          { "type": "text", "text": stats.transferred.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#ff9f43" }
        ],
        "margin": "md"
      });
    }

    // SLA is always shown as critical info
    statusRows.push({
      "type": "box",
      "layout": "horizontal",
      "contents": [
        { "type": "text", "text": "🚨 เกิน SLA", "size": "sm", "color": "#ea5455", "flex": 4 },
        { "type": "text", "text": stats.breached.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#ea5455" }
      ],
      "margin": "md"
    });

    const flexContents = {
      "type": "bubble",
      "size": "mega",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": titlePrefix,
            "weight": "bold",
            "size": "xl",
            "color": "#ffffff"
          },
          {
            "type": "text",
            "text": fullDateStr,
            "size": "sm",
            "color": "#ffffff",
            "margin": "sm",
            "weight": "bold"
          },
          {
            "type": "text",
            "text": `ช่วงเวลา: ${timeRangeStr}`,
            "size": "xs",
            "color": "#ffffff",
            "margin": "xs"
          }
        ],
        "backgroundColor": themeColor,
        "paddingAll": "20px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "box",
                "layout": "vertical",
                "contents": [
                  { "type": "text", "text": "🆕 งานใหม่", "size": "sm", "color": "#8c9196" },
                  { "type": "text", "text": stats.new.toString(), "weight": "bold", "size": "xxl", "margin": "sm", "color": themeColor }
                ]
              }
            ]
          },
          {
            "type": "separator",
            "margin": "xl"
          },
          {
            "type": "box",
            "layout": "vertical",
            "contents": statusRows,
            "margin": "xl"
          }
        ],
        "paddingAll": "20px"
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "uri",
              "label": "เปิดหน้า Dashboard",
              "uri": process.env.NEXT_PUBLIC_BASE_URL || "https://neoworkspace.vercel.app"
            },
            "style": "primary",
            "color": themeColor
          }
        ],
        "paddingAll": "10px"
      }
    };

    try {
      await sendLineGroupFlexNotification(`📊 ${titlePrefix} (${start.toFormat('dd/MM')})`, flexContents);
    } catch (lineErr: any) {
      return NextResponse.json({ 
        success: false, 
        error: lineErr.message,
        stats 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, stats });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
