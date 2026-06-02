const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env vars
const envPath = path.resolve(__dirname, '../../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let url = '', key = '';
envContent.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function run() {
  console.log('Fetching customers...');
  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .select('id, hospital_id, department_id');
    
  if (custErr) throw custErr;
  
  const customerMap = new Map();
  customers.forEach(c => customerMap.set(c.id, { h: c.hospital_id, d: c.department_id }));
  
  console.log(`Loaded ${customerMap.size} customers. Fetching tickets...`);
  
  const { data: tickets, error: ticketErr } = await supabase
    .from('tickets')
    .select('id, customer_id, hospital_id, current_department_id');
    
  if (ticketErr) throw ticketErr;
  
  let updatedCount = 0;
  
  for (const t of tickets) {
    const cust = customerMap.get(t.customer_id);
    if (!cust) continue;
    
    let needsUpdate = false;
    let payload = {};
    
    // Check if ticket missing hospital_id but customer has it
    if (!t.hospital_id && cust.h) {
      payload.hospital_id = cust.h;
      needsUpdate = true;
    }
    // Check if ticket missing department_id but customer has it
    if (!t.current_department_id && cust.d) {
      payload.current_department_id = cust.d;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      const { error } = await supabase.from('tickets').update(payload).eq('id', t.id);
      if (error) console.error(`Error updating ticket ${t.id}:`, error.message);
      else updatedCount++;
    }
  }
  
  console.log(`Backfill complete. Updated ${updatedCount} tickets.`);
}

run().catch(console.error);
