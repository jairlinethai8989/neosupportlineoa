
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRoles() {
  console.log('🔄 Checking for profiles with legacy role "Admin"...');
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'Admin');

  if (error) {
    console.error('❌ Error fetching profiles:', error.message);
    return;
  }

  if (data.length === 0) {
    console.log('✅ No profiles found with role "Admin".');
  } else {
    console.log(`Found ${data.length} profiles to update.`);
    for (const profile of data) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'Administrator' })
        .eq('id', profile.id);
      
      if (updateError) {
        console.error(`❌ Failed to update ${profile.full_name}:`, updateError.message);
      } else {
        console.log(`✅ Updated ${profile.full_name} to Administrator.`);
      }
    }
  }

  // Double check if Administrator exists
  const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'Administrator');
  console.log(`ℹ️ Current Administrators count: ${admins?.length || 0}`);
}

fixRoles();
