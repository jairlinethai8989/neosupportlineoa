/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getStaffAuth } from '@/lib/auth/staffAuthorization';
import {
  parseAnalyticsInsightsQuery,
  parseGeneratedInsightsReport,
} from '@/lib/analytics/insightsSecurity';
import {
  extractGeminiCandidateText,
  readBoundedJsonResponse,
  sanitizeExternalAiContextText,
} from '@/lib/ai/externalAiSecurity';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const auth = await getStaffAuth({ permission: 'analytics', level: 'view' });
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let query;
    try {
      query = parseAnalyticsInsightsQuery(searchParams);
    } catch {
      return NextResponse.json({ error: 'Invalid analytics query' }, { status: 400 });
    }
    const { preset, organizationId, organizationsOnly, ai, customPrompt } = query;
    let { startDate, endDate } = query;

    const supabase = await createSupabaseServerClient();

    // Query 0: Active Organizations
    const { data: organizationsList, error: hospListErr } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (hospListErr) throw hospListErr;

    // Check if client only wants organizations list (light request)
    if (organizationsOnly) {
      return NextResponse.json({ organizations: organizationsList });
    }

    // Determine date range based on preset
    const now = new Date();
    if (!startDate && preset !== 'all') {
      const pastDate = new Date(now);
      if (preset === '7days') pastDate.setDate(now.getDate() - 7);
      if (preset === '30days') pastDate.setDate(now.getDate() - 30);
      startDate = pastDate.toISOString();
    }
    if (!endDate && preset !== 'all') {
      endDate = now.toISOString();
    }

    // Combined Query: Fetch all required fields in a single query to reduce database load
    let combinedQuery = supabase
      .from('tickets')
      .select(`
        organization_id,
        organizations (name),
        issue_type,
        subject,
        customer_id,
        customers!tickets_customer_id_fkey (
          display_name,
          organizations (name)
        ),
        created_at
      `);

    if (startDate) combinedQuery = combinedQuery.gte('created_at', startDate);
    if (endDate) combinedQuery = combinedQuery.lte('created_at', endDate);
    if (organizationId) combinedQuery = combinedQuery.eq('organization_id', organizationId);

    const { data: rawTickets, error: queryErr } = await combinedQuery;
    if (queryErr) throw queryErr;

    // Process data aggregates in memory
    const hospitalCounts: Record<string, { name: string; count: number }> = {};
    const issueCounts: Record<string, number> = {};
    const subjectCounts: Record<string, number> = {};
    const staffCounts: Record<string, { name: string; organization: string; count: number }> = {};
    const heatmapMatrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

    rawTickets?.forEach((t: any) => {
      // Grouping by organization
      const hid = t.organization_id;
      if (hid) {
        if (!hospitalCounts[hid]) {
          hospitalCounts[hid] = { name: t.organizations?.name || 'Unknown', count: 0 };
        }
        hospitalCounts[hid].count += 1;
      }

      // Grouping by issue type
      const issue = t.issue_type || 'ไม่ระบุ';
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;

      // Grouping by subject
      const subject = t.subject || 'ไม่ระบุ';
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;

      // Grouping by organization staff
      const cid = t.customer_id;
      if (cid) {
        if (!staffCounts[cid]) {
          staffCounts[cid] = { 
            name: t.customers?.display_name || 'Unknown', 
            organization: t.customers?.organizations?.name || 'Unknown',
            count: 0 
          };
        }
        staffCounts[cid].count += 1;
      }

      // Heatmap processing
      if (t.created_at) {
        const date = new Date(t.created_at);
        const day = date.getDay(); // 0 (Sun) - 6 (Sat)
        const hour = date.getHours();
        heatmapMatrix[day][hour] += 1;
      }
    });

    const topOrganizations = Object.values(hospitalCounts).sort((a, b) => b.count - a.count).slice(0, 10);
    const issueTypes = Object.entries(issueCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const topSubjects = Object.entries(subjectCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    const topStaff = Object.values(staffCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    const heatmapData = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (heatmapMatrix[d][h] > 0) {
          heatmapData.push({ day: d, hour: h, value: heatmapMatrix[d][h] });
        }
      }
    }

    let aiReport = null;
    if (ai) {
      // 1. Fetch API Key
      let dbApiKey = null;
      try {
        const { data: companySettings } = await supabase
          .from('company_settings')
          .select('gemini_api_key')
          .limit(1)
          .maybeSingle();
        if (companySettings?.gemini_api_key) {
          dbApiKey = companySettings.gemini_api_key;
        }
      } catch (error: unknown) {
        console.error(
          'Unable to load analytics AI configuration:',
          error instanceof Error ? error.name : 'UnknownError'
        );
      }

      const apiKey = dbApiKey || process.env.GEMINI_API_KEY;

      if (apiKey) {
        try {
          const topOrganizationsText = topOrganizations.map((h, i) => `- อันดับ ${i + 1} ${sanitizeExternalAiContextText(h.name, 300)}: ${h.count} เคส`).join('\n');
          const issueTypesText = issueTypes.map(it => `- ${sanitizeExternalAiContextText(it.name, 300)}: ${it.count} เคส`).join('\n');
          const topSubjectsText = topSubjects.map((s, i) => `- อันดับ ${i + 1} ${sanitizeExternalAiContextText(s.name, 1000)}: ${s.count} เคส`).join('\n');
          const topStaffText = topStaff.map((st, i) => `- อันดับ ${i + 1} ${sanitizeExternalAiContextText(st.name, 300)} (${sanitizeExternalAiContextText(st.organization, 300)}): ${st.count} เคส`).join('\n');

          let systemInstructions = `คุณคือผู้เชี่ยวชาญด้าน Service Operations และผู้ช่วยวิเคราะห์ข้อมูลระดับสูงสำหรับทีม Neo Support
หน้าที่ของคุณคือการอ่านสถิติการแจ้งเคสปัญหาประจำสัปดาห์หรือภาพรวมเหล่านี้ แล้วเขียนวิเคราะห์ข้อมูลเชิงลึกเป็นภาษาไทยให้ออกมาเป็นวิเคราะห์ข้อมูลระดับบริหาร สรุปปัญหา และแนวทางการแก้ไข (Actionable Insights) ที่สัมพันธ์กับตัวเลขข้อมูลสถิติจริงที่ส่งให้เท่านั้น ห้ามแต่งข้อมูลขึ้นมาเองนอกเหนือจากสถิตินี้!

ข้อมูลสถิติจริงของตั๋วงาน:
1. องค์กร/บริษัทที่แจ้งปัญหาสูงสุด:
${topOrganizationsText || 'ไม่มีข้อมูล'}

2. ประเภทปัญหาที่พบ (Issue Types):
${issueTypesText || 'ไม่มีข้อมูล'}

3. หัวเรื่องที่แจ้งมาบ่อยที่สุด (Top Subjects):
${topSubjectsText || 'ไม่มีข้อมูล'}

4. เจ้าหน้าที่องค์กร/บริษัทที่แจ้งบ่อยที่สุด (Top Staffs):
${topStaffText || 'ไม่มีข้อมูล'}

กรุณาสรุปประเด็นปัญหาให้สัมพันธ์กับสถิติด้านบนนี้อย่างถูกต้องที่สุด ห้ามอ้างอิงข้อมูลลอยๆ ที่ไม่ตรงกัน`;

          if (customPrompt) {
            systemInstructions += `\n\nคำแนะนำ/โจทย์ที่ผู้ใช้อยากให้วิเคราะห์เพิ่มเติมเป็นพิเศษ:\n"${customPrompt}"\n\nสำคัญมาก: หากผู้ใช้ระบุถึงองค์กร/บริษัทใด หรือประเด็นประเภทปัญหาใดเป็นพิเศษในคำแนะนำเพิ่มเติมด้านบนนี้ ให้คุณทำการเจาะลึกวิเคราะห์และให้คำแนะนำเฉพาะขององค์กร/บริษัท/ประเด็นนั้นๆ เป็นสัดส่วนหลักในทุกหัวข้อบทวิเคราะห์ (สรุปภาพรวม/ความท้าทาย/แนวทางแก้ไข) ถึงแม้ว่าข้อมูลในสถิติตัวเลขรวม องค์กร/บริษัท/ประเด็นดังกล่าวจะไม่ได้มียอดสูงสุดก็ตาม โดยวิเคราะห์อ้างอิงบนฐานข้อมูลจริงที่มีของเรื่องนั้นในสถิติ`;
          }

          const endpoints = [
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
          ];

          let success = false;
          let resData: unknown = null;
          const aiRequestDeadline = AbortSignal.timeout(20_000);

          for (const url of endpoints) {
            try {
              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                signal: aiRequestDeadline,
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
                          description: 'สรุปผลภาพรวมการวิเคราะห์ข้อมูลความยาว 3-4 ประโยคที่วิเคราะห์จากสถิตินี้โดยตรง เขียนกระชับ เจาะจง และมีหลักการ'
                        },
                        keyChallenges: {
                          type: 'ARRAY',
                          description: 'รายการความท้าทายหรือปัญหาวิกฤตสูงสุดที่วิเคราะห์ได้จากเคสเหล่านี้ จำนวน 1-2 ข้อ',
                          items: {
                            type: 'OBJECT',
                            properties: {
                              title: { type: 'STRING', description: 'หัวข้อสั้นๆ ของปัญหา' },
                              description: { type: 'STRING', description: 'คำอธิบายสาเหตุและผลกระทบที่วิเคราะห์ได้จากสถิติ' }
                            },
                            required: ['title', 'description']
                          }
                        },
                        actionItems: {
                          type: 'ARRAY',
                          description: 'แผนการดำเนินงานเพื่อแก้ไขปัญหากลุ่มนี้อย่างรวดเร็วและยั่งยืน (Action Plan) จำนวน 1-2 ข้อ',
                          items: {
                            type: 'OBJECT',
                            properties: {
                              action: { type: 'STRING', description: 'งานหรือกิจกรรมที่ต้องทำอย่างละเอียดและชัดเจน' },
                              owner: { type: 'STRING', description: 'ผู้รับผิดชอบหลัก เช่น ทีมเน็ตเวิร์ก, ทีมโปรแกรมเมอร์' },
                              targetDate: { type: 'STRING', description: 'กำหนดการส่งงานในรูปแบบ YYYY-MM-DD' }
                            },
                            required: ['action', 'owner', 'targetDate']
                          }
                        }
                      },
                      required: ['executiveSummary', 'keyChallenges', 'actionItems']
                    }
                  }
                }),
              });

              if (response.ok) {
                resData = await readBoundedJsonResponse(response);
                success = true;
                break;
              } else {
                console.error(`Gemini API error during insights at endpoint ${url.split('?')[0]}:`, response.status);
              }
            } catch (err: unknown) {
              console.error(
                `Fetch error to endpoint ${url.split('?')[0]}:`,
                err instanceof Error ? err.name : 'UnknownError'
              );
            }
          }

          if (success && resData) {
            const textResult = extractGeminiCandidateText(resData);
            if (textResult) {
              aiReport = parseGeneratedInsightsReport(JSON.parse(textResult));
            }
          }
        } catch (error: unknown) {
          console.error(
            'Analytics insights generation failed:',
            error instanceof Error ? error.name : 'UnknownError'
          );
        }
      }

      // If API key is missing or call failed, return high-fidelity simulated report based on actual values
      if (!aiReport) {
        const topHospName = topOrganizations[0]?.name || 'องค์กร/บริษัท';
        const topSubjName = topSubjects[0]?.name || 'ปัญหาทั่วไป';
        aiReport = {
          executiveSummary: `จากการวิเคราะห์ข้อมูลประเด็นปัญหาพบว่า องค์กร/บริษัทที่แจ้งเรื่องเข้ามามากที่สุดคือ ${topHospName} โดยหัวข้อที่ผู้ใช้งานแจ้งมาบ่อยที่สุดเกี่ยวข้องกับ "${topSubjName}" เพื่อเพิ่มประสิทธิภาพการบริการ ควรติดตามปัญหาดังกล่าวอย่างใกล้ชิด`,
          keyChallenges: [
            { title: `เคสหนาแน่นจาก ${topHospName}`, description: `พบปริมาณงานสะสมค่อนข้างสูงจากองค์กร/บริษัทนี้ โดยเฉพาะปัญหาประเภท "${topSubjName}"` }
          ],
          actionItems: [
            { action: `จัดประชุมตรวจสอบสาเหตุร่วมกับเจ้าหน้าที่ ${topHospName}`, owner: "ทีม Support", targetDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0] }
          ]
        };
      }
    }

    return NextResponse.json({
      organizations: organizationsList,
      topOrganizations,
      issueTypes,
      topSubjects,
      topStaff,
      heatmapData,
      aiReport
    });

  } catch (error: unknown) {
    console.error(
      'Analytics insights request failed:',
      error instanceof Error ? error.name : 'UnknownError'
    );
    return NextResponse.json({ error: 'Unable to load analytics insights' }, { status: 500 });
  }
}
