
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  const { data: departments, error } = await supabase
    .from('departments')
    .select('*')
    .limit(20);

  if (error) {
    console.error('Error fetching departments:', error);
    return;
  }

  console.log('Departments Data:');
  console.table(departments);
}

inspect();
