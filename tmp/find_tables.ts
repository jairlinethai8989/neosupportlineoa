import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  console.log('--- Finding Conversation Table ---');
  // Query all table names in public
  const { data, error } = await supabase.rpc('get_tables'); // Hope they have an RPC or we can use a trick
  
  if (error) {
     // If no RPC, try a raw query via postgrest trick: select from pg_class (might be blocked)
     // Instead, let's try some common pluralizations:
     const trials = ['conversations', 'conversation', 'chats', 'chat', 'tickets', 'customers'];
     for (const t of trials) {
        const { error: e } = await supabase.from(t).select('id').limit(1);
        console.log(`Checking '${t}': ${e ? 'FAIL (' + e.message + ')' : 'SUCCESS'}`);
     }
  }
}

check();
