const fs = require('fs');
const path = 'src/app/portal/create/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove manual ticket generation
content = content.replace(/\/\/ 1\. Generate Unique Ticket Number.*?\s+const ticketNo = `TIC-\$\{timestamp\}\$\{random\}`;/s, '// 1. Automatic Ticket Number (Database Trigger handles this)');

// 2. Remove ticket_no from payload
content = content.replace(/ticket_no: ticketNo,/s, '');

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully removed manual ticket_no generation to allow DB trigger to work.');
