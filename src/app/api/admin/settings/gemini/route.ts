import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function maskApiKey(key: string | null | undefined): string {
  const trimmed = key?.trim() || '';
  if (!trimmed) return '';
  if (trimmed.length <= 6) return '••••••';
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

async function authorizeMasterSettings(requireEdit: boolean) {
  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, permissions')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'Administrator';
  const perm = (profile?.permissions as Record<string, string> | null)?.settings_master;
  const allowed = isAdmin || (requireEdit ? perm === 'edit' : Boolean(perm && perm !== 'none'));

  if (!allowed) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user };
}

export async function GET() {
  try {
    const auth = await authorizeMasterSettings(false);
    if (auth.error) return auth.error;

    const { data, error } = await supabaseAdmin
      .from('company_settings')
      .select('id, gemini_api_key')
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const key = (data as { id?: number; gemini_api_key?: string | null } | null)?.gemini_api_key || '';
    return NextResponse.json({
      settingsId: data?.id ?? null,
      hasKey: Boolean(key.trim()),
      maskedKey: maskApiKey(key),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load Gemini settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: 'test' | 'save';
      apiKey?: string;
    };
    const action = body.action || 'save';

    const auth = await authorizeMasterSettings(action === 'save');
    if (auth.error) return auth.error;

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('company_settings')
      .select('id, gemini_api_key')
      .limit(1)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json(
        { error: fetchErr?.message || 'Company settings row not found' },
        { status: 500 }
      );
    }

    if (action === 'test') {
      const candidateKey =
        body.apiKey?.trim() ||
        ((row as { gemini_api_key?: string | null }).gemini_api_key || '').trim();

      if (!candidateKey) {
        return NextResponse.json({
          success: false,
          message: 'กรุณากรอก API Key ก่อนทดสอบ',
        });
      }

      const endpoints = [
        {
          url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(candidateKey)}`,
          label: 'Gemini 1.5 Flash (v1)',
        },
        {
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(candidateKey)}`,
          label: 'Gemini 1.5 Flash (v1beta)',
        },
        {
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(candidateKey)}`,
          label: 'Gemini 2.5 Flash (v1beta)',
        },
      ];

      let lastErrorMsg = '';
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Respond with exactly one word: OK' }] }],
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.candidates && data.candidates.length > 0) {
              return NextResponse.json({
                success: true,
                message: `การเชื่อมต่อสำเร็จผ่าน ${endpoint.label}! API Key สามารถใช้งานได้`,
              });
            }
          } else {
            const errorData = await response.json().catch(() => null);
            lastErrorMsg = errorData?.error?.message || response.statusText;
          }
        } catch (err: unknown) {
          lastErrorMsg = err instanceof Error ? err.message : 'Network error';
        }
      }

      return NextResponse.json({
        success: false,
        message: `ล้มเหลว: ${lastErrorMsg || 'ไม่สามารถเชื่อมต่อได้ทุกรุ่นจำลอง'}`,
      });
    }

    const nextKey = (body.apiKey || '').trim();
    const { error: updateErr } = await supabaseAdmin
      .from('company_settings')
      .update({ gemini_api_key: nextKey || null })
      .eq('id', row.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hasKey: Boolean(nextKey),
      maskedKey: maskApiKey(nextKey),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process Gemini settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
