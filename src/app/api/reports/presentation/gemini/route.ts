import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getStaffAuth } from '@/lib/auth/staffAuthorization';
import {
  parseGeneratedPresentationInsights,
  parsePresentationAiRequest,
  type GeneratedPresentationInsights,
} from '@/lib/reports/presentationAiSecurity';
import {
  extractGeminiCandidateText,
  extractRagMessageText,
  parseConfiguredAiEndpoint,
  readBoundedJsonResponse,
} from '@/lib/ai/externalAiSecurity';

export const runtime = 'nodejs';

// Pre-defined fallback AI responses in Thai if no API key is configured or on error
const fallbackInsights = {
  executiveSummary: "ภาพรวมการดำเนินงานในสัปดาห์นี้มีความมั่นคงสูงด้วยจำนวนตั๋วสะสมทั้งหมด 4 รายการ โดยมีอัตราการปิดงานที่ 25% (ปิดแล้ว 1 รายการ) องค์กร/บริษัทสะเมิงมียอดแจ้งปัญหามากที่สุดจำนวน 3 รายการ ซึ่งประเด็นหลักที่ต้องจับตามองคือเรื่องปัญหา PB ที่เกิดขึ้นซ้ำๆ ทีมงานควรจัดลำดับความสำคัญในการหาสาเหตุหลักร่วมกับวิศวกรเพื่อลดความล่าช้าในการแก้ไขปัญหาในระยะยาว",
  keyChallenges: [
    {
      title: "ความเสถียรของระบบ (PB)",
      description: "ตรวจพบการเกิดเคสประเภท PB ซ้ำซ้อนที่องค์กร/บริษัทสะเมิงถึง 3 ครั้ง ซึ่งเป็นปัญหาคอขวดหลักของสัปดาห์นี้"
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
      action: "จัดตั้งคู่มือแก้ไขปัญหาเบื้องต้น (SOP) สำหรับเคสองค์กร/บริษัทสะเมิงเพื่อลด Resolution Time",
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
    "องค์กร/บริษัทสะเมิง": "แนะนำให้รีบจัดลำดับความสำคัญของปัญหา PB เป็นเคสระดับวิกฤต (Critical SLA) และส่งเจ้าหน้าที่ประสานงานประสานข้อมูลเชิงลึกในวันจันทร์นี้ เนื่องจากมียอดรายงานซ้ำกันถึง 3 เคส"
  }
};

export async function POST(req: Request) {
  try {
    const auth = await getStaffAuth({ permission: 'reports', level: 'edit' });
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let input;
    try {
      input = parsePresentationAiRequest(await req.json());
    } catch {
      return NextResponse.json({ error: 'Invalid presentation AI request' }, { status: 400 });
    }
    const { ticketData, customPrompt } = input;

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

    const apiKey = dbApiKey || process.env.GEMINI_API_KEY;

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
    if (ticketData.topOrganizations && ticketData.topOrganizations.length > 0) {
      hospitalDetailsText = ticketData.topOrganizations.map((h, idx) => {
        const ticketSubjects = h.tickets.map((t) => `- ${t.subject} (${t.status})`).join('\n');
        return `องค์กร/บริษัทอันดับที่ ${idx + 1}: ${h.name}
- ตั๋วงานทั้งหมด: ${h.totalTickets} เคส (ปิดแล้ว: ${h.resolvedTickets} เคส)
- รายการเรื่องที่แจ้ง:
${ticketSubjects}`;
      }).join('\n\n');
    }

    const systemInstructions = `คุณคือผู้เชี่ยวชาญด้าน Service Operations และผู้ช่วยวิเคราะห์ข้อมูลระดับสูงสำหรับทีม Neo Support Line OA หน้าที่ของคุณคือการอ่านสถิติการแจ้งเคสปัญหาประจำสัปดาห์เหล่านี้ แล้วเขียนวิเคราะห์ข้อมูลเป็นภาษาไทยให้ออกมาเป็นภาษาที่เป็นมืออาชีพ สละสลวย เจาะลึก และนำไปใช้ได้จริง (Actionable Insights)

ข้อมูลสถิติประจำสัปดาห์:
- จำนวนปัญหาทั้งหมด (Total Volume): ${totalTickets} เคส
- อัตราปิดงานสำเร็จ (Resolution Rate): ${resolvedRate}%
- องค์กร/บริษัทที่แจ้งปัญหาสูงสุด: ${topHospital} (${topHospitalCount} เคส)
- ประเภทปัญหาที่พบสูงสุด: ${topCategory} (${topCategoryCount} เคส)

รายละเอียดเคสเชิงลึกแบ่งรายองค์กร/บริษัทหลัก:
${hospitalDetailsText}

คำแนะนำ/โจทย์ที่ผู้ใช้อยากให้เน้นเพิ่มเติม:
"${customPrompt || 'โปรดเน้นเขียนสรุปภาพรวมผู้บริหารแบบเฉียบคม สรุปความเสี่ยงทางเทคนิคที่พบ และคำแนะนำเพื่อแก้ไขปัญหาอย่างยั่งยืน'}"

สำคัญมาก: หากมีข้อความในช่อง "คำแนะนำ/โจทย์ที่ผู้ใช้อยากให้เน้นเพิ่มเติม" ด้านบน คุณต้องตอบสนองและปรับปรุงเนื้อหาการวิเคราะห์ (สรุปภาพรวม, ความท้าทาย, แผนงานแก้ไข, ข้อมูลราย รพ.) ให้เจาะลึกและสอดคล้องตามที่ผู้ใช้สั่งอย่างเคร่งครัดเป็นพิเศษ`;

    // 4. Hit AI Server (RAG fallback to Gemini)
    let aiResult: GeneratedPresentationInsights | null = null;
    const ragUrl = getConfiguredRagEndpoint();
    const ragApiKey = process.env.RAG_API_KEY || '';
    const ragModel = process.env.RAG_MODEL_NAME || 'qwen';

    if (ragUrl) {
      try {
        console.log('Calling RAG Server...');
        const ragResponse = await fetch(ragUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(ragApiKey ? { 'Authorization': `Bearer ${ragApiKey}` } : {})
          },
          body: JSON.stringify({
            model: ragModel,
            messages: [
              { role: 'system', content: systemInstructions },
              { role: 'user', content: `กรุณาวิเคราะห์ข้อมูลตามคำสั่งและคืนค่าเป็น JSON ล้วนๆ ห้ามมี markdown ใดๆ 
โครงสร้าง JSON ต้องประกอบด้วย:
{
  "executiveSummary": "string",
  "keyChallenges": [{"title": "string", "description": "string"}],
  "actionItems": [{"action": "string", "owner": "string", "targetDate": "YYYY-MM-DD"}],
  "hospitalInsights": {"hospitalName": "string"}
}` }
            ],
            stream: false,
            format: 'json'
          }),
          signal: AbortSignal.timeout(12_000)
        });

        if (ragResponse.ok) {
          let ragText = extractRagMessageText(await readBoundedJsonResponse(ragResponse)) || '';
          
          if (ragText.startsWith('```json')) {
            ragText = ragText.replace(/^```json/i, '').replace(/```$/i, '').trim();
          }

          if (ragText) {
            aiResult = parseGeneratedPresentationInsights(JSON.parse(ragText));
          }
        } else {
          console.warn('RAG Server error, status:', ragResponse.status);
        }
      } catch (error: unknown) {
        console.warn(
          'RAG presentation request failed; falling back to Gemini:',
          error instanceof Error ? error.name : 'UnknownError'
        );
      }
    }

    if (!aiResult) {
      console.log('Calling Gemini API...');
      const endpoints = [
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
      ];

      let success = false;
      let resData: unknown = null;
      const geminiDeadline = AbortSignal.timeout(20_000);

      for (const url of endpoints) {
        try {
          const response = await fetch(url, {
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
                      description: 'คีย์ค่าแนะนำเชิงลึกรายองค์กร/บริษัท โดยคีย์เป็นชื่อองค์กร/บริษัทเป้าหมาย (เช่น องค์กร/บริษัทสะเมิง) และค่าเป็นข้อความวิเคราะห์สั้นๆ เจาะจงสำหรับองค์กร/บริษัทนั้น',
                      properties: {}
                    }
                  },
                  required: ['executiveSummary', 'keyChallenges', 'actionItems', 'hospitalInsights']
                }
              }
            }),
            signal: geminiDeadline,
          });

          if (response.ok) {
            resData = await readBoundedJsonResponse(response);
            success = true;
            break;
          } else {
            console.error(
              `Gemini presentation endpoint (${url.split('?')[0]}) failed:`,
              response.status
            );
          }
        } catch (error: unknown) {
          console.error(
            `Gemini presentation fetch (${url.split('?')[0]}) failed:`,
            error instanceof Error ? error.name : 'UnknownError'
          );
        }
      }

      if (!success || !resData) {
        throw new Error('Gemini presentation endpoints failed');
      }

      const parsedText = extractGeminiCandidateText(resData);
      if (!parsedText) {
        throw new Error('Invalid or empty response structure from Gemini API');
      }

      aiResult = parseGeneratedPresentationInsights(JSON.parse(parsedText));
    }
    return NextResponse.json({
      ...aiResult,
      isSimulated: false
    });

  } catch (error: unknown) {
    console.error(
      'Presentation AI generation failed:',
      error instanceof Error ? error.name : 'UnknownError'
    );
    
    // Return gracefully a fallback mock response with error flag so the UI doesn't crash
    return NextResponse.json({
      ...fallbackInsights,
      isSimulated: true
    });
  }
}

function getConfiguredRagEndpoint() {
  try {
    return parseConfiguredAiEndpoint(process.env.RAG_SERVER_URL);
  } catch {
    console.warn('Ignoring invalid RAG_SERVER_URL configuration');
    return null;
  }
}
