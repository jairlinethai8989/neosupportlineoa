const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// Find exact context using the output we saw
const idx = c.indexOf("สรุปผลการแก้ไขงาน (Resolution Summary)");
const before = c.substring(idx - 200, idx);
const after = c.substring(idx, idx + 200);
console.log('BEFORE:');
console.log(JSON.stringify(before));
console.log('AFTER:');
console.log(JSON.stringify(after));
