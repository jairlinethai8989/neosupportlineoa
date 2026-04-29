const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixRoles() {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'Administrator' })
    .eq('role', 'Admin')
    .select();

  if (error) {
    console.error('Error updating roles:', error);
  } else {
    console.log(`Successfully updated ${data.length} profiles from 'Admin' to 'Administrator'.`);
  }
}

fixRoles();
