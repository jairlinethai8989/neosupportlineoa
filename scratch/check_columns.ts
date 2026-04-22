
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkColumns() {
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching ticket:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Available columns in tickets table:', Object.keys(data[0]));
  } else {
    console.log('No tickets found to check columns.');
  }
}

checkColumns();
