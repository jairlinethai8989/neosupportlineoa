
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://luddlewsxlppgaidsbyt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGRsZXdzeGxwcGdhaWRzYnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjIxMDIsImV4cCI6MjA4ODM5ODEwMn0.VM_qaXnvO4cV0GiyS9DozPMjt_qs9IWXz9cZV96dzik';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetadata() {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('content, media_metadata, sender_type')
    .eq('message_type', 'image')
    .eq('sender_type', 'customer')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  for (const m of messages) {
    console.log('URL:', m.content);
    console.log('Metadata:', JSON.stringify(m.media_metadata, null, 2));
    console.log('---');
  }
}

checkMetadata();
