const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// Wipe out all invalid notification types
c = c.replace(/type: 'error'/g, "type: 'ticket'");
c = c.replace(/type: 'warning'/g, "type: 'ticket'");
c = c.replace(/type: 'success'/g, "type: 'ticket'");

fs.writeFileSync(path, c, 'utf8');
console.log('✅ CLEANED: All invalid toast types removed from tickets/page.tsx');
