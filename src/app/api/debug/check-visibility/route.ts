import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getStaffAuth } from '@/lib/auth/staffAuthorization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_DEBUG_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const auth = await getStaffAuth({ roles: ['Administrator'] });
  if (!auth) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: organizations } = await supabase.from('organizations').select('*');
    const { data: depts } = await supabase.from('departments').select('*');
    const { data: positions } = await supabase.from('positions').select('*');

    const { data: hCols } = await supabase.from('organizations').select('*').limit(1);
    const { data: dCols } = await supabase.from('departments').select('*').limit(1);
    const { data: tCols } = await supabase.from('tickets').select('*').limit(1);
    const { data: cCols } = await supabase.from('customers').select('*').limit(1);

    // Try finding the real "conversations" table name
    const { data: convTry } = await supabase.from('conversations').select('*').limit(1);
    const { data: chatTry } = await supabase.from('chats').select('*').limit(1);
    const { data: sessTry } = await supabase.from('chat_sessions').select('*').limit(1);

    return NextResponse.json({ 
      success: true, 
      counts: {
        organizations: organizations?.length || 0,
        departments: depts?.length || 0,
        positions: positions?.length || 0
      },
      table_check: {
        has_conversations: !!convTry,
        has_chats: !!chatTry,
        has_chat_sessions: !!sessTry
      },
      columns: {
        organizations: hCols?.[0] ? Object.keys(hCols[0]) : [],
        departments: dCols?.[0] ? Object.keys(dCols[0]) : [],
        tickets: tCols?.[0] ? Object.keys(tCols[0]) : [],
        customers: cCols?.[0] ? Object.keys(cCols[0]) : []
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message });
  }
}
