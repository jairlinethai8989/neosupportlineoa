import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase.from('company_settings').select('*').limit(1);
  if (error) {
    console.error('Error fetching company_settings:', error);
  } else {
    console.log('Sample company_settings data:', data[0] ? Object.keys(data[0]) : 'No data');
  }
}

checkSchema();
