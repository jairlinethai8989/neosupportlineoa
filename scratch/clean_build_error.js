const fs = require('fs');

const files = [
  'src/app/(dashboard)/inbox/page.tsx',
  'src/app/(dashboard)/tickets/page.tsx',
  'src/app/(dashboard)/tickets/[id]/page.tsx'
];

files.forEach(path => {
  if (!fs.existsSync(path)) return;
  let c = fs.readFileSync(path, 'utf8');

  // Fix duplicate border property and clean up
  c = c.replace(/border:\s*'1px solid var\(--border\)',\s*fontWeight:\s*'800',\s*border:\s*'none'/g, "border: '1px solid var(--border)', fontWeight: '800'");
  
  fs.writeFileSync(path, c, 'utf8');
  console.log(`✅ Cleaned: ${path}`);
});
