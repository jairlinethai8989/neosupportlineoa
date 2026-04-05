import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  console.log('--- Checking tickets table columns ---');
  // We try to select one row and see the keys
  const { data, error } = await supabase.from('tickets').select('*').limit(1);
  if (error) {
    console.error('Error fetching tickets:', error.message);
    if (error.message.includes('column')) {
       console.log('Confirmed: Schema mismatch or missing column.');
    }
  } else if (data && data.length > 0) {
    console.log('Columns found:', Object.keys(data[0]));
  } else {
    console.log('No data in tickets table, but query succeeded. Let try to get column names via RPC or similar (if available) or just try a dummy insert.');
    const { error: insErr } = await supabase.from('tickets').insert([{ dummy_non_existent: 1 }]);
    console.log('Hint from failed insert:', insErr?.message);
  }
}

check();
