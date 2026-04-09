
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://luddlewsxlppgaidsbyt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGRsZXdzeGxwcGdhaWRzYnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjIxMDIsImV4cCI6MjA4ODM5ODEwMn0.VM_qaXnvO4cV0GiyS9DozPMjt_qs9IWXz9cZV96dzik';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const tables = ['messages', 'tickets', 'conversations', 'customers', 'profiles'];
  
  for (const table of tables) {
    console.log(`--- Table: ${table} ---`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error checking ${table}:`, error.message);
    } else if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).join(', '));
    } else {
      console.log('No data found to infer columns.');
    }
  }
}

checkSchema();
