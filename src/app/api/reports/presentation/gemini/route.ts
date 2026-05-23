/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Pre-defined fallback AI responses in Thai if no API key is configured or on error
const fallbackInsights = {
  executiveSummary: "ภาพรวมการดำเนินงานในสัปดาห์นี้มีความมั่นคงสูงด้วยจำนวนตั๋วสะสมทั้งหมด 4 รายการ โดยมีอัตราการปิดงานที่ 25% (ปิดแล้ว 1 รายการ) โรงพยาบาลสะเมิงมียอดแจ้งปัญหามากที่สุดจำนวน 3 รายการ ซึ่งประเด็นหลักที่ต้องจับตามองคือเรื่องปัญหา PB ที่เกิดขึ้นซ้ำๆ ทีมงานควรจัดลำดับความสำคัญในการหาสาเหตุหลักร่วมกับวิศวกรเพื่อลดความล่าช้าในการแก้ไขปัญหาในระยะยาว",
  keyChallenges: [
    {
      title: "ความเสถียรของระบบ (PB)",
      description: "ตรวจพบการเกิดเคสประเภท PB ซ้ำซ้อนที่โรงพยาบาลสะเมิงถึง 3 ครั้ง ซึ่งเป็นปัญหาคอขวดหลักของสัปดาห์นี้"
    },
    {
      title: "อัตราความเร็วในการแก้ปัญหา (Resolution Rate)",
      description: "อัตราปิดงานปัจจุบันอยู่ที่ 25% ซึ่งล่าช้ากว่าเป้าหมายปกติเนื่องจากเคสส่วนใหญ่อยู่ระหว่างรอข้อมูลทางเทคนิคเพิ่มเติม"
    }
  ],
  actionItems: [
    {
      action: "หาสาเหตุหลักและแนวทางป้องกันปัญหา PB ร่วมกับทีม Technical Architect",
      owner: "ทีมวิศวกรระบบ (System Engineer Team)",
      targetDate: "2026-05-26"
    },
    {
      action: "จัดตั้งคู่มือแก้ไขปัญหาเบื้องต้น (SOP) สำหรับเคสโรงพยาบาลสะเมิงเพื่อลด Resolution Time",
      owner: "ทีมซัพพอร์ตหน้างาน (On-site Support Team)",
      targetDate: "2026-05-28"
    },
    {
      action: "โทรติดตามผลเคสที่ค้างคาเพื่อเร่งปิดสถานะเป็น Resolved",
      owner: "ผู้จัดการแผนกซัพพอร์ต (Support Manager)",
      targetDate: "2026-05-25"
    }
  ],
  hospitalInsights: {
    "โรงพยาบาลสะเมิง": "แนะนำให้รีบจัดลำดับความสำคัญของปัญหา PB เป็นเคสระดับวิกฤต (Critical SLA) และส่งเจ้าหน้าที่ประสานงานประสานข้อมูลเชิงลึกในวันจันทร์นี้ เนื่องจากมียอดรายงานซ้ำกันถึง 3 เคส"
  }
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { ticketData, customPrompt, userApiKey } = body;

    if (!ticketData) {
      return NextResponse.json({ error: 'Missing ticketData payload.' }, { status: 400 });
    }

    // 1. Auth check
    const profileBypassAuth =
      process.env.NODE_ENV !== 'production' &&
      process.env.PROFILE_BYPASS_AUTH === '1';

    if (!profileBypassAuth) {
      const supabaseServer = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabaseServer.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 2. Determine API Key
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

    const apiKey = userApiKey || dbApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Graceful fallback for local development or demo purposes if no API key is provided
      console.log('Gemini API Key not found. Returning premium simulated insights.');
      return NextResponse.json({ 
        ...fallbackInsights,
        isSimulated: true
      });
    }

    // 3. Prepare AI Prompt with weekly statistics
    const totalTickets = ticketData.summary.totalTickets;
    const resolvedRate = ticketData.summary.resolvedRate;
    const topHospital = ticketData.summary.topHospital.name;
    const topHospitalCount = ticketData.summary.topHospital.count;
    const topCategory = ticketData.summary.topCategory.name;
    const topCategoryCount = ticketData.summary.topCategory.count;

    let hospitalDetailsText = '';
    if (ticketData.topHospitals && ticketData.topHospitals.length > 0) {
      hospitalDetailsText = ticketData.topHospitals.map((h: any, idx: number) => {
        const ticketSubjects = h.tickets.map((t: any) => `- ${t.subject} (${t.status})`).join('\n');
        return `โรงพยาบาลอันดับที่ ${idx + 1}: ${h.name}
- ตั๋วงานทั้งหมด: ${h.totalTickets} เคส (ปิดแล้ว: ${h.resolvedTickets} เคส)
- รายการเรื่องที่แจ้ง:
${ticketSubjects}`;
      }).join('\n\n');
    }

    const systemInstructions = `คุณคือผู้เชี่ยวชาญด้าน Service Operations และผู้ช่วยวิเคราะห์ข้อมูลระดับสูงสำหรับทีม Neo Support Line OA หน้าที่ของคุณคือการอ่านสถิติการแจ้งเคสปัญหาประจำสัปดาห์เหล่านี้ แล้วเขียนวิเคราะห์ข้อมูลเป็นภาษาไทยให้ออกมาเป็นภาษาที่เป็นมืออาชีพ สละสลวย เจาะลึก และนำไปใช้ได้จริง (Actionable Insights)

ข้อมูลสถิติประจำสัปดาห์:
- จำนวนปัญหาทั้งหมด (Total Volume): ${totalTickets} เคส
- อัตราปิดงานสำเร็จ (Resolution Rate): ${resolvedRate}%
- โรงพยาบาลที่แจ้งปัญหาสูงสุด: ${topHospital} (${topHospitalCount} เคส)
- ประเภทปัญหาที่พบสูงสุด: ${topCategory} (${topCategoryCount} เคส)

รายละเอียดเคสเชิงลึกแบ่งรายโรงพยาบาลหลัก:
${hospitalDetailsText}

คำแนะนำ/โจทย์ที่ผู้ใช้อยากให้เน้นเพิ่มเติม:
"${customPrompt || 'โปรดเน้นเขียนสรุปภาพรวมผู้บริหารแบบเฉียบคม สรุปความเสี่ยงทางเทคนิคที่พบ และคำแนะนำเพื่อแก้ไขปัญหาอย่างยั่งยืน'}"`;

    // 4. Hit Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: systemInstructions,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                executiveSummary: { 
                  type: 'STRING',
                  description: 'สรุปผลภาพรวมการดำเนินงานของสัปดาห์นี้สำหรับผู้บริหาร เขียนอย่างเป็นทางการ กระชับ ความยาวประมาณ 3-5 ประโยค'
                },
                keyChallenges: {
                  type: 'ARRAY',
                  description: 'รายการความท้าทายหรือปัญหาวิกฤตสูงสุดที่วิเคราะห์ได้จากเคสในสัปดาห์นี้ จำนวน 2-3 ข้อ',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      title: { type: 'STRING', description: 'หัวข้อสั้นๆ ของปัญหา เช่น ปัญหาความเสถียรของระบบ' },
                      description: { type: 'STRING', description: 'คำอธิบายสาเหตุและผลกระทบของปัญหานั้นๆ' }
                    },
                    required: ['title', 'description']
                  }
                },
                actionItems: {
                  type: 'ARRAY',
                  description: 'แผนการดำเนินงานเพื่อแก้ไขปัญหากลุ่มนี้อย่างรวดเร็วและยั่งยืน (Action Plan) จำนวน 2-3 ข้อ',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      action: { type: 'STRING', description: 'งานหรือกิจกรรมที่ต้องทำอย่างละเอียดและชัดเจน' },
                      owner: { type: 'STRING', description: 'ผู้รับผิดชอบหลัก เช่น ทีมเน็ตเวิร์ก, ทีมโปรแกรมเมอร์' },
                      targetDate: { type: 'STRING', description: 'กำหนดการส่งงานในรูปแบบ YYYY-MM-DD' }
                    },
                    required: ['action', 'owner', 'targetDate']
                  }
                },
                hospitalInsights: {
                  type: 'OBJECT',
                  description: 'คีย์ค่าแนะนำเชิงลึกรายโรงพยาบาล โดยคีย์เป็นชื่อโรงพยาบาลเป้าหมาย (เช่น โรงพยาบาลสะเมิง) และค่าเป็นข้อความวิเคราะห์สั้นๆ เจาะจงสำหรับโรงพยาบาลนั้น',
                  properties: {}
                }
              },
              required: ['executiveSummary', 'keyChallenges', 'actionItems', 'hospitalInsights']
            }
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API returned error status:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.statusText} (${response.status})`);
    }

    const resData = await response.json();
    const parsedText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!parsedText) {
      throw new Error('Invalid or empty response structure from Gemini API');
    }

    const aiResult = JSON.parse(parsedText);
    return NextResponse.json({
      ...aiResult,
      isSimulated: false
    });

  } catch (error: unknown) {
    console.error('Error calling Gemini endpoint:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    // Return gracefully a fallback mock response with error flag so the UI doesn't crash
    return NextResponse.json({
      ...fallbackInsights,
      isSimulated: true,
      errorMsg: message
    });
  }
}
