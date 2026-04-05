import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('--- Seeding Essential Data ---');

  // 1. Hospital
  const { data: hData } = await supabase.from('hospitals').select('id').limit(1);
  if (!hData || hData.length === 0) {
    console.log('Seeding default hospital...');
    const { error: hErr } = await supabase.from('hospitals').insert([{ name: 'โรงพยาบาลทั่วไป (ศูนย์หลัก)', is_active: true }]);
    if (hErr) console.error('H-Err:', hErr);
  } else {
    console.log('Hospital exists.');
  }

  // 2. Department
  const { data: dData } = await supabase.from('departments').select('id').limit(1);
  if (!dData || dData.length === 0) {
    console.log('Seeding default departments...');
    const { error: dErr } = await supabase.from('departments').insert([
        { name: 'แผนกไอที (IT)', is_active: true },
        { name: 'แผนกการพยาบาล', is_active: true },
        { name: 'แผนกธุรการ/หน้าเคาน์เตอร์', is_active: true }
    ]);
    if (dErr) console.error('D-Err:', dErr);
  } else {
    console.log('Departments exist.');
  }

  // 3. Position
  const { data: pData } = await supabase.from('positions').select('id').limit(1);
  if (!pData || pData.length === 0) {
    console.log('Seeding default positions...');
    const { error: pErr } = await supabase.from('positions').insert([
        { name: 'เจ้าหน้าที่ทั่วไป', is_active: true },
        { name: 'พยาบาลวิชาชีพ', is_active: true },
        { name: 'หัวหน้าแผนก', is_active: true }
    ]);
    if (pErr) console.error('P-Err:', pErr);
  } else {
    console.log('Positions exist.');
  }

  console.log('Done.');
}

seed();
