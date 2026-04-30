import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  // SECURITY: Only allow in development AND when explicitly enabled
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_DEBUG_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const results = {
    hospitals: '',
    departments: '',
    positions: ''
  };

  try {
    // 1. Hospital
    const { data: hData } = await supabase.from('hospitals').select('id').limit(1);
    if (!hData || hData.length === 0) {
      await supabase.from('hospitals').insert([{ name: 'โรงพยาบาลทั่วไป (ศูนย์หลัก)', is_active: true }]);
      results.hospitals = 'Seeded default hospital.';
    } else {
      results.hospitals = 'Already exists.';
    }

    // 2. Department
    const { data: dData } = await supabase.from('departments').select('id').limit(1);
    if (!dData || dData.length === 0) {
      await supabase.from('departments').insert([
          { name: 'แผนกไอที (IT)', is_active: true },
          { name: 'แผนกการพยาบาล', is_active: true },
          { name: 'แผนกธุรการ/หน้าเคาน์เตอร์', is_active: true }
      ]);
      results.departments = 'Seeded default departments.';
    } else {
      results.departments = 'Already exists.';
    }

    // 3. Position
    const { data: pData } = await supabase.from('positions').select('id').limit(1);
    if (!pData || pData.length === 0) {
      await supabase.from('positions').insert([
          { name: 'เจ้าหน้าที่ทั่วไป', is_active: true },
          { name: 'พยาบาลวิชาชีพ', is_active: true },
          { name: 'หัวหน้าแผนก', is_active: true }
      ]);
      results.positions = 'Seeded default positions.';
    } else {
      results.positions = 'Already exists.';
    }

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message });
  }
}
