const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Extract template section
const templateSectionMatch = c.match(/(<div style=\{\{\s*marginBottom:\s*'(?:20|24)px'\s*\}\}>\s*<div style=\{\{\s*display:\s*'flex',\s*justifyContent:\s*'space-between'.*?เทมเพลตสรุปงาน.*?<\/div>\s*<\/div>)/s);
if (templateSectionMatch) {
    const templateSection = templateSectionMatch[0];
    c = c.replace(templateSection, '');
    c = c.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // 2. Insert before summary label (Resolution Summary)
    const marker = /<label style=\{\{\s*display:\s*'block',.*?สรุปผลการแก้ไขงาน.*?\)/s;
    c = c.replace(marker, (m) => {
        return `${templateSection}\n\n                   ${m}`;
    });
    
    fs.writeFileSync(path, c, 'utf8');
    console.log('✅ Success: tickets/page.tsx reordered');
} else {
    console.log('❌ Template section not found');
}
