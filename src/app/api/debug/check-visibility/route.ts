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

    const { data: hCols } = await supabase.from('hospitals').select('*').limit(1);
    const { data: dCols } = await supabase.from('departments').select('*').limit(1);
    const { data: tCols } = await supabase.from('tickets').select('*').limit(1);
    const { data: cCols } = await supabase.from('customers').select('*').limit(1);

    return NextResponse.json({ 
      success: true, 
      counts: {
        hospitals: hospitals?.length || 0,
        departments: depts?.length || 0,
        positions: positions?.length || 0
      },
      columns: {
        hospitals: hCols?.[0] ? Object.keys(hCols[0]) : [],
        departments: dCols?.[0] ? Object.keys(dCols[0]) : [],
        tickets: tCols?.[0] ? Object.keys(tCols[0]) : [],
        customers: cCols?.[0] ? Object.keys(cCols[0]) : []
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
