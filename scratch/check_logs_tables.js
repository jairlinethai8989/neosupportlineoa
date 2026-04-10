
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://luddlewsxlppgaidsbyt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGRsZXdzeGxwcGdhaWRzYnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjIxMDIsImV4cCI6MjA4ODM5ODEwMn0.VM_qaXnvO4cV0GiyS9DozPMjt_qs9IWXz9cZV96dzik';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllTables() {
  // Try common table names to see which ones exist
  const potentialTables = ['logs', 'system_logs', 'audit_logs', 'activity_logs', 'ticket_logs'];
  
  for (const table of potentialTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      if (error.code === '42P01') {
        console.log(`Table '${table}' does NOT exist.`);
      } else {
        console.error(`Error checking '${table}':`, error.message);
      }
    } else {
      console.log(`Table '${table}' EXISTS.`);
      if (data && data.length > 0) {
        console.log(`Columns for '${table}':`, Object.keys(data[0]).join(', '));
      } else {
        console.log(`Table '${table}' is empty.`);
      }
    }
  }
}

checkAllTables();
