import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://luddlewsxlppgaidsbyt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGRsZXdzeGxwcGdhaWRzYnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjIxMDIsImV4cCI6MjA4ODM5ODEwMn0.VM_qaXnvO4cV0GiyS9DozPMjt_qs9IWXz9cZV96dzik'
)

async function debugProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'admin')
    .limit(5)
    
  if (error) {
    console.error('Error fetching admin profiles:', error)
    return
  }
  
  if (data.length === 0) {
    console.log('No admin profiles found. Checking all profiles...')
    const { data: all } = await supabase.from('profiles').select('id, full_name, role').limit(10)
    console.log('Found profiles:', all)
  } else {
    console.log('Admin profiles:', data)
  }
}

debugProfiles()
