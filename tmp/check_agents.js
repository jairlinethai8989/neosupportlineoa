import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://luddlewsxlppgaidsbyt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGRsZXdzeGxwcGdhaWRzYnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjIxMDIsImV4cCI6MjA4ODM5ODEwMn0.VM_qaXnvO4cV0GiyS9DozPMjt_qs9IWXz9cZV96dzik'
)

async function getAgents() {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, id')
    .limit(5)
  if (error) {
    console.error(error)
    return
  }
  console.log('Available Agents:', data)
}

getAgents()
