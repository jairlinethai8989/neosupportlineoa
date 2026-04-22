
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addEscalationTokenColumn() {
  console.log('Checking for escalation_token column...');
  
  const { error } = await supabaseAdmin.from('tickets').select('escalation_token').limit(1);
  
  if (error && error.code === 'PGRST204') {
     console.log('Column does NOT exist. You need to run SQL:');
     console.log('ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS escalation_token TEXT;');
     console.log('CREATE INDEX IF NOT EXISTS idx_tickets_escalation_token ON public.tickets(escalation_token);');
  } else if (!error) {
     console.log('Column escalation_token already exists.');
  } else {
     console.error('Error:', error);
  }
}

addEscalationTokenColumn();
