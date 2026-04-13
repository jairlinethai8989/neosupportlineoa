const fs = require('fs');
const path = 'src/app/portal/create/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Further increase randomness/uniqueness to avoid collisions
const newGeneration = `
         // 1. Generate Ticket Number using Hospital Abbreviation + Timestamp + 6-digit Random
         const hospitalAbbr = customerData.hospitals?.abbreviation || 'NEO';
         const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
         const randomStr = Math.floor(100000 + Math.random() * 900000); 
         const ticketNo = \`\${hospitalAbbr}-\${dateStr}-\${randomStr}\`;

         // 2. Insert Ticket
         const ticketPayload: any = {
            ticket_no: ticketNo,`;

content = content.replace(/\/\/ 1\. Generate Ticket Number using Hospital Abbreviation.*?\/\/ 2\. Insert Ticket\s+const ticketPayload: any = \{/s, newGeneration);

// 2. Update Theme to Blue
content = content.replace(/--portal-primary: #00f2fe;/g, '--portal-primary: #0062ff;');
content = content.replace(/background: 'linear-gradient\(135deg, #00f2fe 0%, #4facfe 100%\)'/g, "background: 'linear-gradient(135deg, #0062ff 0%, #00d2ff 100%)'");

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated ticket uniqueness to 6-digit random and changed theme to BLUE.');
