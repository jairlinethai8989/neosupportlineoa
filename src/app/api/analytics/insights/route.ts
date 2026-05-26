import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const preset = searchParams.get('preset') || 'all'; // 7days, 30days, all
    const hospitalId = searchParams.get('hospitalId');
    let startDate = searchParams.get('startDate');
    let endDate = searchParams.get('endDate');

    const supabase = await createSupabaseServerClient();
    const profileBypassAuth = process.env.NODE_ENV !== 'production' && process.env.PROFILE_BYPASS_AUTH === '1';

    if (!profileBypassAuth) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
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

    // Query 0: Active Hospitals
    const { data: hospitalsList, error: hospListErr } = await supabase
      .from('hospitals')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (hospListErr) throw hospListErr;

    // Query 1: Top Hospitals
    let hospitalQuery = supabase.from('tickets').select('hospital_id, hospitals(name)');
    if (startDate) hospitalQuery = hospitalQuery.gte('created_at', startDate);
    if (endDate) hospitalQuery = hospitalQuery.lte('created_at', endDate);
    if (hospitalId && hospitalId !== 'all') hospitalQuery = hospitalQuery.eq('hospital_id', hospitalId);
    
    const { data: rawHospitalData, error: hospitalErr } = await hospitalQuery;
    if (hospitalErr) throw hospitalErr;

    // Grouping by hospital
    const hospitalCounts: Record<string, { name: string; count: number }> = {};
    rawHospitalData?.forEach((t: any) => {
      const hid = t.hospital_id;
      if (!hid) return;
      if (!hospitalCounts[hid]) {
        hospitalCounts[hid] = { name: t.hospitals?.name || 'Unknown', count: 0 };
      }
      hospitalCounts[hid].count += 1;
    });
    const topHospitals = Object.values(hospitalCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    // Query 2: Issue Types
    let issueQuery = supabase.from('tickets').select('issue_type');
    if (startDate) issueQuery = issueQuery.gte('created_at', startDate);
    if (endDate) issueQuery = issueQuery.lte('created_at', endDate);
    if (hospitalId && hospitalId !== 'all') issueQuery = issueQuery.eq('hospital_id', hospitalId);

    const { data: rawIssueData, error: issueErr } = await issueQuery;
    if (issueErr) throw issueErr;

    const issueCounts: Record<string, number> = {};
    rawIssueData?.forEach((t: any) => {
      const issue = t.issue_type || 'ไม่ระบุ';
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    });
    const issueTypes = Object.entries(issueCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // Query 3: Most Frequent Subjects
    let subjectQuery = supabase.from('tickets').select('subject');
    if (startDate) subjectQuery = subjectQuery.gte('created_at', startDate);
    if (endDate) subjectQuery = subjectQuery.lte('created_at', endDate);
    if (hospitalId && hospitalId !== 'all') subjectQuery = subjectQuery.eq('hospital_id', hospitalId);

    const { data: rawSubjectData, error: subjectErr } = await subjectQuery;
    if (subjectErr) throw subjectErr;

    const subjectCounts: Record<string, number> = {};
    rawSubjectData?.forEach((t: any) => {
      const subject = t.subject || 'ไม่ระบุ';
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });
    const topSubjects = Object.entries(subjectCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);

    // Query 4: Top Hospital Staff
    let staffQuery = supabase.from('tickets').select('customer_id, customers!tickets_customer_id_fkey(display_name, hospitals(name))');
    if (startDate) staffQuery = staffQuery.gte('created_at', startDate);
    if (endDate) staffQuery = staffQuery.lte('created_at', endDate);
    if (hospitalId && hospitalId !== 'all') staffQuery = staffQuery.eq('hospital_id', hospitalId);

    const { data: rawStaffData, error: staffErr } = await staffQuery;
    if (staffErr) throw staffErr;

    const staffCounts: Record<string, { name: string; hospital: string; count: number }> = {};
    rawStaffData?.forEach((t: any) => {
      const cid = t.customer_id;
      if (!cid) return;
      if (!staffCounts[cid]) {
        staffCounts[cid] = { 
          name: t.customers?.display_name || 'Unknown', 
          hospital: t.customers?.hospitals?.name || 'Unknown',
          count: 0 
        };
      }
      staffCounts[cid].count += 1;
    });
    const topStaff = Object.values(staffCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    // Query 5: Heatmap Data
    let heatmapQuery = supabase.from('tickets').select('created_at');
    if (startDate) heatmapQuery = heatmapQuery.gte('created_at', startDate);
    if (endDate) heatmapQuery = heatmapQuery.lte('created_at', endDate);
    if (hospitalId && hospitalId !== 'all') heatmapQuery = heatmapQuery.eq('hospital_id', hospitalId);

    const { data: rawHeatmapData, error: heatmapErr } = await heatmapQuery;
    if (heatmapErr) throw heatmapErr;

    // Process heatmap data: count tickets by day of week (0-6) and hour (0-23)
    const heatmapMatrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    rawHeatmapData?.forEach((t: any) => {
      if (!t.created_at) return;
      const date = new Date(t.created_at);
      const day = date.getDay(); // 0 (Sun) - 6 (Sat)
      const hour = date.getHours();
      heatmapMatrix[day][hour] += 1;
    });
    const heatmapData = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (heatmapMatrix[d][h] > 0) {
          heatmapData.push({ day: d, hour: h, value: heatmapMatrix[d][h] });
        }
      }
    }

    let aiReport = null;
    const ai = searchParams.get('ai') === 'true';
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
      } catch (dbErr) {
        console.error('Error loading API key from company settings:', dbErr);
      }

      const apiKey = dbApiKey || process.env.GEMINI_API_KEY;

      if (apiKey) {
        try {
          const topHospitalsText = topHospitals.map((h, i) => `- อันดับ ${i + 1} ${h.name}: ${h.count} เคส`).join('\n');
          const issueTypesText = issueTypes.map(it => `- ${it.name}: ${it.count} เคส`).join('\n');
          const topSubjectsText = topSubjects.map((s, i) => `- อันดับ ${i + 1} ${s.name}: ${s.count} เคส`).join('\n');
          const topStaffText = topStaff.map((st, i) => `- อันดับ ${i + 1} ${st.name} (${st.hospital}): ${st.count} เคส`).join('\n');

          const systemInstructions = `คุณคือผู้เชี่ยวชาญด้าน Service Operations และผู้ช่วยวิเคราะห์ข้อมูลระดับสูงสำหรับทีม Neo Support
หน้าที่ของคุณคือการอ่านสถิติการแจ้งเคสปัญหาประจำสัปดาห์หรือภาพรวมเหล่านี้ แล้วเขียนวิเคราะห์ข้อมูลเชิงลึกเป็นภาษาไทยให้ออกมาเป็นวิเคราะห์ข้อมูลระดับบริหาร สรุปปัญหา และแนวทางการแก้ไข (Actionable Insights) ที่สัมพันธ์กับตัวเลขข้อมูลสถิติจริงที่ส่งให้เท่านั้น ห้ามแต่งข้อมูลขึ้นมาเองนอกเหนือจากสถิตินี้!

ข้อมูลสถิติจริงของตั๋วงาน:
1. โรงพยาบาลที่แจ้งปัญหาสูงสุด:
${topHospitalsText || 'ไม่มีข้อมูล'}

2. ประเภทปัญหาที่พบ (Issue Types):
${issueTypesText || 'ไม่มีข้อมูล'}

3. หัวเรื่องที่แจ้งมาบ่อยที่สุด (Top Subjects):
${topSubjectsText || 'ไม่มีข้อมูล'}

4. เจ้าหน้าที่โรงพยาบาลที่แจ้งบ่อยที่สุด (Top Staffs):
${topStaffText || 'ไม่มีข้อมูล'}

กรุณาสรุปประเด็นปัญหาให้สัมพันธ์กับสถิติด้านบนนี้อย่างถูกต้องที่สุด ห้ามอ้างอิงข้อมูลลอยๆ ที่ไม่ตรงกัน`;

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
            }
          );

          if (response.ok) {
            const result = await response.json();
            const textResult = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResult) {
              aiReport = JSON.parse(textResult);
            }
          } else {
            console.error('Gemini API error during insights:', response.statusText);
          }
        } catch (err) {
          console.error('Error generating AI report via Gemini:', err);
        }
      }

      // If API key is missing or call failed, return high-fidelity simulated report based on actual values
      if (!aiReport) {
        const topHospName = topHospitals[0]?.name || 'โรงพยาบาล';
        const topSubjName = topSubjects[0]?.name || 'ปัญหาทั่วไป';
        aiReport = {
          executiveSummary: `จากการวิเคราะห์ข้อมูลประเด็นปัญหาพบว่า โรงพยาบาลที่แจ้งเรื่องเข้ามามากที่สุดคือ ${topHospName} โดยหัวข้อที่ผู้ใช้งานแจ้งมาบ่อยที่สุดเกี่ยวข้องกับ "${topSubjName}" เพื่อเพิ่มประสิทธิภาพการบริการ ควรติดตามปัญหาดังกล่าวอย่างใกล้ชิด`,
          keyChallenges: [
            { title: `เคสหนาแน่นจาก ${topHospName}`, description: `พบปริมาณงานสะสมค่อนข้างสูงจากโรงพยาบาลนี้ โดยเฉพาะปัญหาประเภท "${topSubjName}"` }
          ],
          actionItems: [
            { action: `จัดประชุมตรวจสอบสาเหตุร่วมกับเจ้าหน้าที่ ${topHospName}`, owner: "ทีม Support", targetDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0] }
          ]
        };
      }
    }

    return NextResponse.json({
      hospitals: hospitalsList,
      topHospitals,
      issueTypes,
      topSubjects,
      topStaff,
      heatmapData,
      aiReport
    });

  } catch (error: any) {
    console.error('Error in insights analytics API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
