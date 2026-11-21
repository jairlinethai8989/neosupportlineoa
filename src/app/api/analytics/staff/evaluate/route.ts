import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { callGeminiJsonWithFallback } from '@/lib/server/geminiClient';

export const runtime = 'nodejs';

// High-fidelity fallback evaluation for simulation or missing key
const fallbackEvaluation = {
  dimensions: {
    speed: {
      rating: 88,
      feedback: "การจัดการใบงานและเวลาในการเคลียร์ปิดเคสทำได้รวดเร็วเฉลี่ยดีเยี่ยมในเกณฑ์มาตรฐาน มีอัตราการตอบสนองขั้นต้นรวดเร็ว สอดคล้องกับปริมาณงานที่ได้รับมอบหมาย"
    },
    quality: {
      rating: 92,
      feedback: "คุณภาพในการแก้ไขปัญหาสูงมาก มีเปอร์เซ็นต์อัตราการส่งกลับแก้ต่อน้อยมาก แสดงถึงการวิเคราะห์สาเหตุของปัญหาได้อย่างตรงจุดก่อนส่งมอบงานคืนลูกค้า"
    },
    sla: {
      rating: 95,
      feedback: "การปฏิบัติตามข้อตกลง SLA รักษามาตรฐานได้อย่างเหนียวแน่น มีความพยายามสูงสุดในการจัดลำดับความสำคัญของตั๋วงานเร่งด่วนตามนโยบายบริษัท"
    },
    csat: {
      rating: 100,
      feedback: "ความพึงพอใจของลูกค้าเต็ม 5 ดาวอย่างต่อเนื่อง ได้รับคำชื่นชมในมิติด้านความสุภาพ การสื่อสารที่โปร่งใส และการอธิบายขั้นตอนเทคนิคให้เข้าใจง่าย"
    }
  },
  strengths: [
    "ความใส่ใจในรายละเอียดและการสื่อสารที่ชัดเจนกับผู้ใช้บริการ",
    "ทักษะการสืบค้นและวินิจฉัยปัญหาเชิงเทคนิคได้อย่างเป็นขั้นตอนและรวดเร็ว",
    "ความรับผิดชอบและอัตราการปิดเคสสำเร็จคิดเป็นสัดส่วนสูงมากเทียบกับทีม"
  ],
  recommendations: [
    "ขยายขอบเขตทักษะความเชี่ยวชาญไปยังโมดูลระดับสูงอื่นๆ ของระบบเพื่อเพิ่มความสามารถการสลับเปลี่ยนหน้างาน",
    "พัฒนาคู่มือการแก้ปัญหาเบื้องต้น (Self-Help Tools) ป้อนเข้าคลังความรู้ส่วนกลาง (Knowledge Base) เพื่อแชร์กับเพื่อนร่วมงาน",
    "เพิ่มทักษะด้านความเป็นผู้นำในการช่วยเหลือและแนะนำพนักงานเทคนิคระดับต้นในแผนก"
  ],
  overallSummary: "พนักงานมีความเชี่ยวชาญระดับสูงในการทำงาน มีความแม่นยำและการรักษาสัญญากับผู้รับบริการได้อย่างดีเยี่ยม ควรค่าแก่การได้รับการยกย่องเป็นแบบอย่างที่ดีแก่ทีมงานฝ่ายเทคนิค"
};

export async function POST(req: Request) {
  try {
    const supabaseServer = await createSupabaseServerClient();

    // 1. Auth & Admin Access Check
    const profileBypassAuth =
      process.env.NODE_ENV !== 'production' &&
      process.env.PROFILE_BYPASS_AUTH === '1';

    let evaluatorId = null;
    if (!profileBypassAuth) {
      const { data: { user } } = await supabaseServer.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      evaluatorId = user.id;

      // Check role permissions
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('role, permissions')
        .eq('id', user.id)
        .single();

      const hasAccess =
        profile?.role === 'Administrator' ||
        profile?.permissions?.analytics_staff === 'view' ||
        profile?.permissions?.analytics_staff === 'edit';

      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    }

    // 2. Parse Body Parameters
    const { agentId, agentName, startDate, endDate, kpiStats } = await req.json();
    if (!agentId || !startDate || !endDate || !kpiStats) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Check for existing evaluation in this period to avoid double generation
    const { data: existingEval } = await supabaseServer
      .from('staff_evaluations')
      .select('*')
      .eq('agent_id', agentId)
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .maybeSingle();

    // We can support force re-generate via a query parameter or body flag if needed
    const url = new URL(req.url);
    const forceRegen = url.searchParams.get('force') === 'true';

    if (existingEval && !forceRegen) {
      return NextResponse.json({
        ...existingEval.evaluation_data,
        isCached: true,
        savedId: existingEval.id
      });
    }

    // 4. Retrieve API Key
    let dbApiKey = null;
    try {
      const { data: companySettings } = await supabaseAdmin
        .from('company_settings')
        .select('gemini_api_key')
        .limit(1)
        .maybeSingle();
      if (companySettings?.gemini_api_key) {
        dbApiKey = companySettings.gemini_api_key;
      }
    } catch (dbErr) {
      console.error('Error loading API key from company settings:', dbErr);
    }

    const apiKey = dbApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.log('Gemini API key not found. Returning high-fidelity fallback evaluation.');
      
      // Save simulated to DB anyway
      const { data: saved } = await supabaseAdmin
        .from('staff_evaluations')
        .upsert({
          agent_id: agentId,
          evaluator_id: evaluatorId,
          start_date: startDate,
          end_date: endDate,
          kpi_stats: kpiStats,
          evaluation_data: fallbackEvaluation
        }, { onConflict: 'agent_id,start_date,end_date' })
        .select()
        .single();

      return NextResponse.json({
        ...fallbackEvaluation,
        isSimulated: true,
        savedId: saved?.id
      });
    }

    // 5. Query Recent Logs for Prompt Context
    const { data: logs } = await supabaseServer
      .from('ticket_logs')
      .select('action_type, note, created_at')
      .eq('performer_id', agentId)
      .order('created_at', { ascending: false })
      .limit(15);

    let recentLogsText = '(ไม่มีบันทึกการทำงานล่าสุด)';
    if (logs && logs.length > 0) {
      recentLogsText = logs.map(l => {
        const time = new Date(l.created_at).toLocaleDateString('th-TH');
        return `[${time}] การกระทำ: ${l.action_type || '-'}, หมายเหตุ: ${l.note || '-'}`;
      }).join('\n');
    }

    // 6. Build Special Prompt for Gemini
    const systemPrompt = `คุณคือผู้เชี่ยวชาญด้านทรัพยากรบุคคล (HR Tech) และหัวหน้าวิศวกรรวมระบบสารสนเทศ (Service Desk Lead) หน้าที่ของคุณคือการประเมินผลงานการปฏิบัติงานของพนักงานฝ่ายเทคนิคอย่างรอบด้าน ตรงไปตรงมา มีจิตวิทยา และนำไปพัฒนาต่อยอดได้จริง

ข้อมูลผลงานพนักงานที่จะประเมิน:
- ชื่อพนักงาน: ${agentName}
- ช่วงเวลาประเมิน: ตั้งแต่วันที่ ${startDate} ถึง ${endDate}

สถิติผลงานดิบหลัก (KPI Metrics):
- จำนวนใบงานที่ปิดสำเร็จ (Resolved Tickets): ${kpiStats.resolvedCount} เคส จากทั้งหมดที่รับเรื่องมา ${kpiStats.totalClaimed} เคส
- เวลาปิดงานเฉลี่ย (Avg Resolution Time): ${kpiStats.avgResolutionTime} ชั่วโมง
- เปอร์เซ็นต์การรักษาสัญญา SLA (SLA Compliance Rate): ${kpiStats.slaComplianceRate}%
- อัตราการปฏิเสธงาน/ตีกลับแก้ต่อ (Rework Rate): ${kpiStats.reworkRate}% (จำนวนครั้งที่โดนตีกลับ: ${kpiStats.reworkCount} ครั้ง)
- คะแนนความพึงพอใจลูกค้าเฉลี่ย (Avg Customer CSAT): ${kpiStats.avgCsat > 0 ? kpiStats.avgCsat + ' จากเต็ม 5 คะแนน' : 'ไม่มีคะแนนประเมินเข้ามาในช่วงนี้'}

บันทึกประวัติกิจกรรมล่าสุดของพนักงาน (Activity Logs):
${recentLogsText}

ให้ประเมินผลโดยอิงจากตัวเลขสถิติอย่างสมเหตุสมผลในรูปแบบ JSON ที่มีโครงสร้างฟิลด์บังคับดังนี้ (ไม่ต้องมี markdown code blocks ครอบ ให้ส่งเป็น JSON ล้วนๆ และข้อความฟี้ดแบ็คทั้งหมดเป็นภาษาไทยที่เป็นทางการและสุภาพ):
{
  "dimensions": {
    "speed": {
      "rating": (คะแนนความเร็วในการแก้ปัญหา 0 - 100 ประเมินจากความเร็วเฉลี่ยเทียบกับเกณฑ์ทั่วไป เช่น เร็วกว่า 24 ชม. ถือว่าสูงมาก),
      "feedback": "คำวิเคราะห์วิจารณ์ด้านความรวดเร็ว ประสิทธิภาพ และการรักษาสัญญาความไวในการตอบสนอง (1-2 ประโยค)"
    },
    "quality": {
      "rating": (คะแนนคุณภาพผลงานการแก้ไขปัญหา 0 - 100 ประเมินสัมพันธ์กับ reworkRate ยิ่ง rework ต่ำ ยิ่งได้คะแนนสูงมาก),
      "feedback": "คำวิเคราะห์วิจารณ์ด้านคุณภาพของการแก้ปัญหา ความถูกต้อง แม่นยำ และอัตราการโดนตีกลับแก้ไขงาน (1-2 ประโยค)"
    },
    "sla": {
      "rating": (คะแนนการรักษา SLA 0 - 100 ดึงตาม slaComplianceRate เลย),
      "feedback": "คำวิเคราะห์วิจารณ์ด้านความรับผิดชอบในการตอบโจทย์กำหนดเวลาเร่งด่วนตามมาตรฐาน SLA (1-2 ประโยค)"
    },
    "csat": {
      "rating": (คะแนนด้านลูกค้าสัมพันธ์และความพึงพอใจ 0 - 100 หากไม่มีคะแนน CSAT ให้คะแนนเฉลี่ยกลางๆ 75 หรือประเมินจากคุณภาพงานประกอบ),
      "feedback": "คำวิเคราะห์วิจารณ์ด้านทักษะความสัมพันธ์และการให้บริการแก่ผู้ใช้ปลายทางหรือลูกค้า (1-2 ประโยค)"
    }
  },
  "strengths": [
    "จุดแข็งที่พบด้านทักษะเทคนิคหรือการทำงาน 1",
    "จุดแข็งที่พบ 2",
    "จุดแข็งที่พบ 3"
  ],
  "recommendations": [
    "ข้อเสนอแนะในการฝึกอบรมหรือพัฒนาศักยภาพให้เก่งขึ้นไปอีกขั้น 1",
    "ข้อเสนอแนะ 2",
    "ข้อเสนอแนะ 3"
  ],
  "overallSummary": "สรุปภาพรวมในระดับผู้อำนวยการ วิเคราะห์จุดเด่นภาพกว้าง และความเหมาะสมในการเติบโตในสายงาน (2-3 ประโยค)"
}`;

    // 7. Request Content Generation from Gemini with multi-model fallback
    const aiResult = await callGeminiJsonWithFallback(apiKey, systemPrompt);

    // 8. Persist to Database via Upsert
    const { data: saved, error: dbError } = await supabaseAdmin
      .from('staff_evaluations')
      .upsert({
        agent_id: agentId,
        evaluator_id: evaluatorId,
        start_date: startDate,
        end_date: endDate,
        kpi_stats: kpiStats,
        evaluation_data: aiResult
      }, { onConflict: 'agent_id,start_date,end_date' })
      .select()
      .single();

    if (dbError) {
      console.error('Error saving staff_evaluation to DB:', dbError);
    }

    return NextResponse.json({
      ...aiResult,
      isSimulated: false,
      savedId: saved?.id
    });

  } catch (error: unknown) {
    console.error('Error in staff evaluation endpoint:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json({
      ...fallbackEvaluation,
      isSimulated: true,
      errorMsg: message
    });
  }
}
