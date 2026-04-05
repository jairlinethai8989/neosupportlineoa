import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: hospitals, error: hErr } = await supabase.from('hospitals').select('*');
    const { data: depts, error: dErr } = await supabase.from('departments').select('*');
    const { data: positions, error: pErr } = await supabase.from('positions').select('*');

    return NextResponse.json({ 
      success: true, 
      counts: {
        hospitals: hospitals?.length || 0,
        departments: depts?.length || 0,
        positions: positions?.length || 0
      },
      errors: {
        h: hErr?.message,
        d: dErr?.message,
        p: pErr?.message
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
