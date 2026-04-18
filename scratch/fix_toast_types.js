const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// Replace invalid notification types with valid ones ('ticket')
c = c.replace(/type: 'error'/g, "type: 'ticket'");
c = c.replace(/type: 'warning'/g, "type: 'ticket'");

fs.writeFileSync(path, c, 'utf8');
console.log('✅ FIXED: Toast notification types in tickets/page.tsx');
