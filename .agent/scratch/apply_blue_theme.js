const fs = require('fs');
const files = [
  'src/app/portal/page.tsx',
  'src/app/portal/create/page.tsx',
  'src/app/portal/tickets/[id]/page.tsx',
  'src/app/portal/layout.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    
    // Change Cyan to Blue
    content = content.replace(/#00f2fe/g, '#0062ff');
    content = content.replace(/rgba\(0, 242, 254/g, 'rgba(0, 98, 255');
    content = content.replace(/#4facfe/g, '#00d2ff');
    
    // Update gradients
    content = content.replace(/linear-gradient\(135deg, #00f2fe 0%, #4facfe 100%\)/g, 'linear-gradient(135deg, #0062ff 0%, #00d2ff 100%)');
    
    fs.writeFileSync(f, content, 'utf8');
    console.log(`Updated theme for ${f}`);
  }
});

// Specifically update the ticket_no generation in create/page.tsx to be EVEN MORE UNIQUE
const createPath = 'src/app/portal/create/page.tsx';
if (fs.existsSync(createPath)) {
  let content = fs.readFileSync(createPath, 'utf8');
  const secureGen = `
         // 1. Generate Ticket Number using Abbr + Date + Time + Random (Extreme Uniqueness)
         const hospitalAbbr = customerData.hospitals?.abbreviation || 'NEO';
         const now = new Date();
         const dateStr = now.toISOString().slice(2, 10).replace(/-/g, ''); 
         const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
         const randomStr = Math.floor(100 + Math.random() * 899); // 3-digit random
         const ticketNo = \`\${hospitalAbbr}-\${dateStr}-\${timeStr}-\${randomStr}\`;

         // 2. Insert Ticket
         const ticketPayload: any = {
            ticket_no: ticketNo,`;
  
  content = content.replace(/\/\/ 1\. Generate Ticket Number using Hospital Abbreviation.*?\/\/ 2\. Insert Ticket\s+const ticketPayload: any = \{/s, secureGen);
  fs.writeFileSync(createPath, content, 'utf8');
}
