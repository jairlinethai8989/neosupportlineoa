const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Find the template section and summary section positions
const labelTpl = 'เทมเพลตสรุปงาน';
const labelSum = 'สรุปผลการแก้ไขงาน';

const tplIdx = c.indexOf(labelTpl);
const sumIdx = c.indexOf(labelSum);

if (tplIdx !== -1 && sumIdx !== -1 && tplIdx < sumIdx) {
    // Extract the template block (it's inside a div)
    const tStart = c.lastIndexOf('<div style={{ marginBottom:', tplIdx);
    const nextDiv = c.indexOf('<div style={{ marginBottom:', tplIdx + 20);
    const tEnd = c.lastIndexOf('</div>', nextDiv);

    if (tStart !== -1 && tEnd !== -1) {
        const fullBlock = c.substring(tStart, tEnd + 6);
        
        // Remove from old place
        c = c.replace(fullBlock, '');
        
        // Find insert point before summary label container
        const insertAnchor = c.indexOf(labelSum);
        const insertPoint = c.lastIndexOf('<div style={{ marginBottom:', insertAnchor);
        
        if (insertPoint !== -1) {
            c = c.substring(0, insertPoint) + fullBlock + '\n\n                ' + c.substring(insertPoint);
            
            // Final check on Issue Type order in this file
            // ad1e2df might have Issue Type in the middle already, but let's confirm label order
            console.log('✅ Reordered modal components in beautiful dashboard UI');
            fs.writeFileSync(path, c, 'utf8');
        }
    }
} else {
    console.log('ℹ️ Order might be correct or labels not found');
}
