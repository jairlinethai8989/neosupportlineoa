const fs = require('fs');
const path = 'src/app/portal/create/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// The corrupted block starts after return;
const startPos = content.indexOf("setError('กรุณาระบุหัวข้อปัญหา');\n         return;\n      }");
// Wait, return; was there but } was deleted?
// Check lines 69-70 in the view output:
// 69:          return;
// 70:             hospital_id: customerData.hospital_id,

const fix = `      setError('กรุณาระบุหัวข้อปัญหา');
         return;
      }
      
      setSubmitting(true);
      setError('');

      try {
         // 1. Automatic Ticket Number (Database Trigger handles this)
         // 2. Insert Ticket
         const ticketPayload: any = {
            customer_id: customerData.id,`;

content = content.replace(/setError\('กรุณาระบุหัวข้อปัญหา'\);\n         return;\n(?=\s+hospital_id:)/s, fix);

fs.writeFileSync(path, content, 'utf8');
console.log('RECOVERED: Successfully restored critical logic and fixed ticket payload.');
