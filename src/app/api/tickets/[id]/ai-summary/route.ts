import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Fallback response for simulated analysis or if API key is missing
const fallbackAnalysis = {
  rootCause: "การตรวจสอบพบว่าเกิดจากปัญหาการตั้งค่าสิทธิ์ผู้ใช้งานในระบบฐานข้อมูลผิดพลาด ทำให้ผู้ใช้งานระดับปฏิบัติการไม่สามารถเข้าถึงเมนูรายงานสถิติได้ (Permission Configuration Error)",
  resolution: "ทีมเทคนิคได้ทำการอัปเดต Role-Based Access Control (RBAC) ใหม่ และเคลียร์แคชระบบเรียบร้อยแล้ว",
  preventiveRecommendations: [
    "ควรมีการทำ Automated Test ทุกครั้งที่มีการอัปเดตโมดูลสิทธิ์ผู้ใช้งาน",
    "จัดทำ SOP ขั้นตอนการกำหนดสิทธิ์ผู้ใช้งานใหม่ให้ครอบคลุมและอัปเดตเป็นเวอร์ชันล่าสุด"
  ]
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;
    if (!ticketId) {
      return NextResponse.json({ error: 'Missing ticket ID' }, { status: 400 });
    }

    const supabaseServer = await createSupabaseServerClient();

    // 1. Auth check
    const profileBypassAuth =
      process.env.NODE_ENV !== 'production' &&
      process.env.PROFILE_BYPASS_AUTH === '1';

    if (!profileBypassAuth) {
      const { data: { user } } = await supabaseServer.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 2. Fetch ticket details and chat history
    const { data: ticket, error: ticketError } = await supabaseServer
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const { data: chats } = await supabaseServer
      .from('messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    // 3. Determine API Key
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
      console.log('Gemini API Key not found. Returning simulated analysis.');
      
      // Save simulated to DB anyway
      await supabaseAdmin
        .from('tickets')
        .update({ ai_analysis: fallbackAnalysis })
        .eq('id', ticketId);

      return NextResponse.json({ ...fallbackAnalysis, isSimulated: true });
    }

    // 4. Prepare Prompt for Gemini
    let chatLog = '';
    if (chats && chats.length > 0) {
      chatLog = chats.map(c => {
        const sender = c.sender_type === 'staff' ? 'Staff' : 'Customer';
        return `[${sender}]: ${c.content}`;
      }).join('\n');
    } else {
      chatLog = '(ไม่มีประวัติการแชท)';
    }

    const systemInstructions = `คุณคือผู้เชี่ยวชาญด้าน Service Desk และ Technical Support หน้าที่ของคุณคือการอ่านข้อมูลตั๋วงานและบทสนทนาการแก้ปัญหา (Chat Log) ต่อไปนี้ และสรุปผลการปิดงาน (Post-Mortem Analysis) ออกมาให้เป็นภาษาไทยที่อ่านง่ายและเป็นทางการ

ข้อมูลตั๋วงาน (Ticket Info):
- เรื่อง (Subject): ${ticket.subject}
- รายละเอียด (Description): ${ticket.description || '-'}
- ประเภทปัญหา (Issue Type): ${ticket.issue_type || '-'}
- สถานะ: ${ticket.status}

ประวัติการสนทนา (Chat Log):
${chatLog}

ให้วิเคราะห์และส่งผลลัพธ์ในรูปแบบ JSON ที่มี 3 ฟิลด์บังคับดังนี้ (ไม่ต้องมี markdown code blocks ครอบ ให้ส่งเป็น JSON ล้วนๆ):
{
  "rootCause": "อธิบายปัญหาที่แท้จริง หรือสาเหตุหลักที่ทำให้เกิดเคสนี้ (1-2 ประโยคสั้นๆ)",
  "resolution": "อธิบายวิธีการแก้ไขที่ทีมงานหรือระบบได้ดำเนินการไป (1-2 ประโยคสั้นๆ)",
  "preventiveRecommendations": [
    "ข้อเสนอแนะที่ 1",
    "ข้อเสนอแนะที่ 2"
  ]
}`;

    // 5. Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemInstructions }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API returned error status:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const resData = await response.json();
    const parsedText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!parsedText) {
      throw new Error('Invalid or empty response structure from Gemini API');
    }

    const aiResult = JSON.parse(parsedText);

    // 6. Save back to database
    const { error: updateError } = await supabaseServer
      .from('tickets')
      .update({ ai_analysis: aiResult })
      .eq('id', ticketId);

    if (updateError) {
      console.error('Error saving ai_analysis to DB:', updateError);
    }

    return NextResponse.json({ ...aiResult, isSimulated: false });

  } catch (error: unknown) {
    console.error('Error calling Gemini endpoint:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    return NextResponse.json({
      ...fallbackAnalysis,
      isSimulated: true,
      errorMsg: message
    });
  }
}
