const fs = require('fs');

const files = [
  'src/app/(dashboard)/tickets/page.tsx',
  'src/app/(dashboard)/tickets/[id]/page.tsx',
  'src/app/(dashboard)/inbox/page.tsx'
];

files.forEach(path => {
  if (!fs.existsSync(path)) return;
  let c = fs.readFileSync(path, 'utf8');

  // 1. Make Issue Type mandatory in button disabled logic
  // Replace: disabled={loading || !resSummary.trim() || !selectedModule}
  // To:      disabled={loading || !resSummary.trim() || !selectedModule || !selectedIssueType}
  // Handle variations in variable names (loading/sending/updating)
  c = c.replace(
    /disabled=\{([^}]+?)\|\| !resSummary\.trim\(\) \|\| !selectedModule\}/g,
    'disabled={$1 || !resSummary.trim() || !selectedModule || !selectedIssueType}'
  );

  // 2. Add asterisk to Work Type label
  c = c.replace(
    /ประเภทงาน<\/label>/g,
    'ประเภทงาน <span style={{ color: \'var(--danger)\' }}>*</span></label>'
  );

  // 3. Fix Module select colors to match theme (change background: 'var(--primary)' to background: 'var(--bg-input)')
  // and fix text color from #000 to var(--text-main) or similar
  // Also remove hardcoded shadows if any
  
  // Specific fix for the Module dropdown style
  c = c.replace(
    /background:\s*'var\(--primary\)',\s*color:\s*'#000',/g,
    "background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)',"
  );
  
  // For tickets/page.tsx specific complex style
  c = c.replace(
    /background:\s*'var\(--primary\)',\s*color:\s*'black',/g,
    "background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)',"
  );
  
  // Remove shadows and fix color for the option text in tickets/page.tsx
  c = c.replace(/boxShadow:\s*'0 8px 12px var\(--primary-glow\)',/g, '');
  c = c.replace(/stroke='black'/g, "stroke='currentColor'"); // Fix arrow color
  c = c.replace(/style=\{\{\s*background:\s*'white',\s*color:\s*'black'\s*\}\}/g, ''); // Fix option backgrounds

  fs.writeFileSync(path, c, 'utf8');
  console.log(`✅ Fixed: ${path}`);
});
