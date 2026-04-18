const fs = require('fs');

const files = [
  'src/app/(dashboard)/tickets/page.tsx',
  'src/app/(dashboard)/tickets/[id]/page.tsx',
  'src/app/(dashboard)/inbox/page.tsx'
];

files.forEach(path => {
  if (!fs.existsSync(path)) return;
  let c = fs.readFileSync(path, 'utf8');

  // Regex to capture the entire 'Templates' section
  // It usually starts with a container div and contains "เทมเพลตสรุปงาน"
  const templateSectionPattern = /<div style=\{\{\s*marginBottom:\s*'(?:20|24)px'\s*\}\}>\s*<div style=\{\{\s*display:\s*'flex',\s*justifyContent:\s*'space-between'.*?<\/div>\s*<\/div>/s;
  
  const match = c.match(templateSectionPattern);
  
  if (match) {
    const templateSection = match[0];
    
    // Remove it from its current position
    c = c.replace(templateSection, '');
    
    // Clean up any double spacing left behind
    c = c.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Insert it before the Resolution Summary section
    // Find the marker for Resolution Summary label
    const summaryMarker = /<label style=\{\{\s*display:\s*'block',.*?สรุปผลการแก้ไขงาน/s;
    
    c = c.replace(summaryMarker, (m) => {
      // Add a bit of spacing adjustment if needed
      return templateSection + '\n\n                ' + m;
    });

    console.log(`✅ Reordered: ${path}`);
    fs.writeFileSync(path, c, 'utf8');
  } else {
    console.warn(`❌ Template section not found in: ${path}`);
  }
});
