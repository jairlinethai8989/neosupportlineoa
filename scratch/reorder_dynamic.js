const fs = require('fs');

const files = [
  'src/app/(dashboard)/tickets/page.tsx',
  'src/app/(dashboard)/tickets/[id]/page.tsx',
  'src/app/(dashboard)/inbox/page.tsx'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf8');

  // Find the template section div (look for label text)
  // We'll look for the div that starts above the "เทมเพลตสรุปงาน" label
  const labelText = 'เทมเพลตสรุปงาน';
  const summaryText = 'สรุปผลการแก้ไขงาน';

  const labelIdx = c.indexOf(labelText);
  const summaryIdx = c.indexOf(summaryText);

  if (labelIdx !== -1 && summaryIdx !== -1 && labelIdx < summaryIdx) {
     // Find the opening <div of the template section (it's the parent container)
     // We look backwards for the start of the section
     const sectionStart = c.lastIndexOf('<div style={{ marginBottom:', labelIdx);
     // Find the closing </div> of that section
     const nextSectionStart = c.indexOf('<div style={{ marginBottom:', labelIdx + labelText.length);
     const sectionEnd = c.lastIndexOf('</div>', nextSectionStart);
     
     if (sectionStart !== -1 && sectionEnd !== -1) {
        const templateBlock = c.substring(sectionStart, sectionEnd + 6);
        
        // Remove the block
        c = c.replace(templateBlock, '');
        
        // Find where to insert (before summary label's container)
        const insertPoint = c.lastIndexOf('<div style={{ marginBottom:', c.indexOf(summaryText));
        
        if (insertPoint !== -1) {
           c = c.substring(0, insertPoint) + templateBlock + '\n\n                ' + c.substring(insertPoint);
           fs.writeFileSync(f, c, 'utf8');
           console.log(`✅ REORDERED: ${f}`);
        }
     }
  } else {
     console.log(`ℹ️ Skip or correct already: ${f}`);
  }
});
