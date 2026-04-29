const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectMasterTables() {
  const tables = ['hospitals', 'departments', 'positions'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    console.log(`--- ${table} Columns ---`);
    if (error) console.error(error);
    else console.log(Object.keys(data[0] || {}));
  }
}

inspectMasterTables();
