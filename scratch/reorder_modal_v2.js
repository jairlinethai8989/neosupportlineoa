const fs = require('fs');

const files = [
  'src/app/(dashboard)/tickets/page.tsx',
  'src/app/(dashboard)/tickets/[id]/page.tsx',
  'src/app/(dashboard)/inbox/page.tsx'
];

files.forEach(path => {
  if (!fs.existsSync(path)) return;
  let c = fs.readFileSync(path, 'utf8');

  // 1. Identify and extract the Template section
  // It starts with a div containing the label "เทมเพลตสรุปงาน"
  // We'll capture from the start of the div (look for marginBottom: '24px' or '20px' before the label)
  const templateSectionMatch = c.match(/(<div style=\{\{\s*marginBottom:\s*'(?:20|24)px'\s*\}\}>\s*<div style=\{\{\s*display:\s*'flex',\s*justifyContent:\s*'space-between'.*?เทมเพลตสรุปงาน.*?<\/div>\s*<\/div>)/s);
  
  if (!templateSectionMatch) {
     console.warn(`❌ Template section not found in: ${path}`);
     return;
  }
  
  const templateSection = templateSectionMatch[0];
  
  // 2. Identify the Summary section marker
  const summaryMarker = /<label style=\{\{\s*display:\s*'block',.*?สรุปผลการแก้ไขงาน.*?RESOLUTION SUMMARY.*?<\/label>/s;
  
  if (!summaryMarker.test(c)) {
     console.warn(`❌ Summary marker not found in: ${path}`);
     return;
  }

  // 3. Move it
  // First, remove template section
  c = c.replace(templateSection, '');
  
  // Normalize spacing
  c = c.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Then insert before summary marker
  // We want to insert it ABOVE the summary label.
  c = c.replace(summaryMarker, (m) => {
     return `${templateSection}\n\n                ${m}`;
  });

  fs.writeFileSync(path, c, 'utf8');
  console.log(`✅ Reordered ${path}`);
});
