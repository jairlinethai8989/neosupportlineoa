const fs = require('fs');
const path = 'src/app/(dashboard)/inbox/page.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(/key\(m\)/g, 'key={m}');
c = c.replace(/key\(it\)/g, 'key={it}');

fs.writeFileSync(path, c, 'utf8');
console.log('✅ JSX KEYS FIXED: Replaced key(...) with key={...}');
