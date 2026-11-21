import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { callGeminiJsonWithFallback } from '@/lib/server/geminiClient';

export const runtime = 'nodejs';

// Honest fallback response when AI service is unavailable or API key is not configured
const fallbackAnalysis = {
  rootCause: "ไม่สามารถวิเคราะห์ด้วย AI ได้ในขณะนี้ (ยังไม่ได้ตั้งค่า API Key หรือไม่สามารถเชื่อมต่อบริการ AI)",
  resolution: "กรุณาตรวจสอบรายละเอียดการแก้ไขจากประวัติการสนทนาและบันทึกปิดงานของเจ้าหน้าที่โดยตรง",
  preventiveRecommendations: [
    "ตรวจสอบการตั้งค่า GEMINI_API_KEY หรือ RAG_SERVER_URL ในระบบ",
    "ลองกดวิเคราะห์ใหม่อีกครั้งเมื่อบริการ AI พร้อมใช้งาน"
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
      console.warn('Gemini API Key not found. Returning unavailable fallback without persisting to DB.');
      return NextResponse.json({ ...fallbackAnalysis, isSimulated: true });
    }

    // 4. Prepare Prompt for Gemini
    let chatLog = '';
    if (chats && chats.length > 0) {
      chatLog = chats.map(c => {
        const sender =
          c.sender_type === 'agent' || c.sender_type === 'staff'
            ? 'Staff'
            : c.sender_type === 'system'
              ? 'System'
              : 'Customer';
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

    // 5. Call AI Server (RAG fallback to Gemini)
    let aiResult = null;
    const ragUrl = process.env.RAG_SERVER_URL;
    const ragApiKey = process.env.RAG_API_KEY || '';
    const ragModel = process.env.RAG_MODEL_NAME || 'qwen';

    if (ragUrl) {
      try {
        console.log('Calling RAG Server...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

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
              { role: 'user', content: 'กรุณาวิเคราะห์ข้อมูลตามคำสั่งและคืนค่าเป็น JSON ล้วนๆ ห้ามมี markdown ใดๆ' }
            ],
            stream: false,
            format: 'json'
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (ragResponse.ok) {
          const ragData = await ragResponse.json();
          let ragText = ragData.choices?.[0]?.message?.content || ragData.message?.content || '';
          
          if (ragText.startsWith('```json')) {
            ragText = ragText.replace(/^```json/i, '').replace(/```$/i, '').trim();
          }

          if (ragText) {
            aiResult = JSON.parse(ragText);
          }
        } else {
          console.warn('RAG Server error, status:', ragResponse.status);
        }
      } catch (err) {
        console.warn('RAG Server connection failed, falling back to Gemini.', err);
      }
    }

    if (!aiResult) {
      console.log('Calling Gemini API with model fallback...');
      aiResult = await callGeminiJsonWithFallback(apiKey, systemInstructions);
    }

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
