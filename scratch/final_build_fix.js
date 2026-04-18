const fs = require('fs');
const files = [
  'src/app/(dashboard)/inbox/page.tsx',
  'src/app/(dashboard)/tickets/page.tsx',
  'src/app/(dashboard)/tickets/[id]/page.tsx'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf8');
  
  // Look for:
  // border: 'none',
  // background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)',
  
  const pattern = /border:\s*'none',\s*\r?\n?\s*background:\s*'var\(--bg-input\)',\s*color:\s*'var\(--text-main\)',\s*border:\s*'1px solid var\(--border\)'/;
  const replacement = "background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)'";
  
  if (pattern.test(c)) {
    c = c.replace(pattern, replacement);
    console.log(`✅ Fixed: ${f}`);
    fs.writeFileSync(f, c, 'utf8');
  } else {
    console.log(`ℹ️ Pattern not found (may already be fixed): ${f}`);
  }
});
