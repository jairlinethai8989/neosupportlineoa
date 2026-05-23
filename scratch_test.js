import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321', // placeholder if env not loaded
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

async function test() {
  console.time('fetchProfile');
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.timeEnd('fetchProfile');
  console.log(error ? 'Error' : 'Success');
}

test();
