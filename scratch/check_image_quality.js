
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://luddlewsxlppgaidsbyt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGRsZXdzeGxwcGdhaWRzYnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjIxMDIsImV4cCI6MjA4ODM5ODEwMn0.VM_qaXnvO4cV0GiyS9DozPMjt_qs9IWXz9cZV96dzik';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkImages() {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('content, created_at')
    .eq('message_type', 'image')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  console.log('Recent 10 images:');
  for (const msg of messages) {
    const url = msg.content;
    if (url.includes('chat_media')) {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            const size = res.headers.get('content-length');
            const type = res.headers.get('content-type');
            console.log(`URL: ${url}`);
            console.log(`Size: ${size} bytes (${(size / 1024).toFixed(2)} KB)`);
            console.log(`Type: ${type}`);
            console.log('---');
        } catch (e) {
            console.log(`URL: ${url} (Failed to fetch info: ${e.message})`);
        }
    } else {
        console.log(`URL: ${url} (External or legacy URL)`);
    }
  }
}

checkImages();
