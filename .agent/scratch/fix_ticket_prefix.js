const fs = require('fs');
const path = 'src/app/portal/create/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update fetchData to also get hospital abbreviation
content = content.replace(
  /const \{ data: customerData, error: custErr \} = await supabase\s+\.from\('customers'\)\s+\.select\('\*'\)/s,
  "const { data: customerData, error: custErr } = await supabase\n            .from('customers')\n            .select('*, hospitals(name, abbreviation)')"
);

// 2. Re-implement ticket_no generation in Code (since trigger is failing)
// We will use ABBR-YYMMDD-RANDOM for maximum uniqueness and readability
const newGeneration = `
         // 1. Generate Ticket Number using Hospital Abbreviation
         const hospitalAbbr = customerData.hospitals?.abbreviation || 'NEO';
         const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
         const randomStr = Math.floor(1000 + Math.random() * 9000);
         const ticketNo = \`\${hospitalAbbr}-\${dateStr}-\${randomStr}\`;

         // 2. Insert Ticket
         const ticketPayload: any = {
            ticket_no: ticketNo,`;

content = content.replace(/\/\/ 1\. Automatic Ticket Number \(Database Trigger handles this\)\s+\/\/ 2\. Insert Ticket\s+const ticketPayload: any = \{/s, newGeneration);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated ticket number logic to use Hospital Abbreviation and Date prefix.');
