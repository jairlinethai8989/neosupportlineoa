import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analyticsService';
import { sendLineGroupFlexNotification } from '@/lib/utils/lineNotifications';
import { DateTime } from 'luxon';

/**
 * API Cron: Daily Summary Notification
 * 
 * Frequency: 
 * 1. Morning Summary (08:30) -> Summarize night shift (Yesterday 17:30 - Today 08:30)
 * 2. Evening Summary (17:30) -> Summarize day shift (Today 08:30 - Today 17:30)
 * 
 * Trigger: /api/cron/daily-summary?key=YOUR_CRON_SECRET
 */

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

    // Determine shift based on hour
    // If before 12:00 -> Morning Report (Night Shift)
    // If after 12:00 -> Evening Report (Day Shift)
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

    const title = reportType === 'Morning' 
      ? '🌅 สรุปงานกะดึก (Night Shift)' 
      : '🌆 สรุปงานประจำวัน (Day Shift)';
    
    const timeRangeStr = `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')}`;
    const dateStr = start.toFormat('dd/MM/yyyy');

    // LINE Flex Message Construction (Simplified for stability)
    const flexContents = {
      "type": "bubble",
      "size": "mega",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": title,
            "weight": "bold",
            "size": "xl",
            "color": "#ffffff"
          },
          {
            "type": "text",
            "text": `ช่วงเวลา: ${timeRangeStr} (${dateStr})`,
            "size": "sm",
            "color": "#e0e0e0",
            "margin": "md"
          }
        ],
        "backgroundColor": reportType === 'Morning' ? "#1a1b4b" : "#4fc3f7",
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
                  { "type": "text", "text": stats.new.toString(), "weight": "bold", "size": "xxl", "margin": "sm", "color": "#333333" }
                ]
              },
              {
                "type": "box",
                "layout": "vertical",
                "contents": [
                  { "type": "text", "text": "✅ ปิดแล้ว", "size": "sm", "color": "#8c9196" },
                  { "type": "text", "text": stats.resolved.toString(), "weight": "bold", "size": "xxl", "margin": "sm", "color": "#28c76f" }
                ]
              }
            ],
            "spacing": "xl"
          },
          {
            "type": "separator",
            "margin": "xl"
          },
          {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  { "type": "text", "text": "⏳ ค้างดำเนินการ", "size": "sm", "color": "#555555", "flex": 4 },
                  { "type": "text", "text": stats.pending.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2 }
                ],
                "margin": "md"
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  { "type": "text", "text": "🚨 เกิน SLA", "size": "sm", "color": "#ea5455", "flex": 4 },
                  { "type": "text", "text": stats.breached.toString(), "size": "sm", "weight": "bold", "align": "end", "flex": 2, "color": "#ea5455" }
                ],
                "margin": "md"
              }
            ],
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
              "label": "เปิด Dashboard",
              "uri": process.env.NEXT_PUBLIC_BASE_URL || "https://neoworkspace.vercel.app"
            },
            "style": "primary",
            "color": "#4fc3f7"
          }
        ],
        "paddingAll": "10px"
      }
    };

    try {
      await sendLineGroupFlexNotification(`📊 รายงานสรุปงาน ${reportType === 'Morning' ? 'กะดึก' : 'ประจำวัน'}`, flexContents);
    } catch (lineErr: any) {
      console.error('Flex Notification Error:', lineErr.message);
      // Return success false but keep stats
      return NextResponse.json({ 
        success: false, 
        error: 'LINE API Failed: ' + lineErr.message,
        report: reportType,
        stats 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      report: reportType,
      stats 
    });

  } catch (error: any) {
    console.error('Daily Summary Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
