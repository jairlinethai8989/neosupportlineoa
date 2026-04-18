const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Extract the Template Block (incorrectly at top)
// Start from its style div to its end div
const tplStartStr = '<div style={{ marginBottom: \'24px\' }}>';
const tplLabelStr = 'เทมเพลตสรุปงาน';
const tplIdx = c.indexOf(tplLabelStr);
const tBlockStart = c.lastIndexOf(tplStartStr, tplIdx);
const tBlockEnd = c.indexOf('</div>\n\n                   <label', tBlockStart) + 7; // up to the end of the div

const templateBlock = c.substring(tBlockStart, tBlockEnd);

// 2. Remove the template block from the original (top) position
c = c.replace(templateBlock, '');

// 3. Find the Summary Label to insert the templates above it
const summaryLabel = '<label style={{ display: \'block\', fontSize: \'11px\', fontWeight: \'800\', color: \'var(--primary)\', textTransform: \'uppercase\', marginBottom: \'12px\', letterSpacing: \'1px\' }}>สรุปผลการแก้ไขงาน';
c = c.replace(summaryLabel, templateBlock + '\n\n                   ' + summaryLabel);

// 4. Ensure Module is correctly labeled and spaced
// (Module should now be at the top of the content area after the template removal)

fs.writeFileSync(path, c, 'utf8');
console.log('✅ RE-ORDERED: Modal elements are now in the correct sequence (Module -> Issue Type -> Templates -> Summary)');
