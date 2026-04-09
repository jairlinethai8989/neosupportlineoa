
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('Checking tickets table columns...');
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching tickets:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns found:', Object.keys(data[0]));
  } else {
    console.log('No data in tickets table.');
  }
}

checkColumns();
