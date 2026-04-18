const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Correct the Modal Order (Precision Replace)
// We identify the blocks by their labels
const tplBlockRegex = /<div style={{ marginBottom: '24px' }}>[\s\S]*?เทมเพลตสรุปงาน[\s\S]*?<\/div>/;
const tplMatch = c.match(tplBlockRegex);

if (tplMatch) {
    const tplBlock = tplMatch[0];
    // Remove templates from top
    c = c.replace(tplBlock, '');
    
    // Insert templates before Summary
    const summaryLabel = '<label style={{ display: \'block\', fontSize: \'11px\', fontWeight: \'800\', color: \'var(--primary)\', textTransform: \'uppercase\', marginBottom: \'12px\', letterSpacing: \'1px\' }}>สรุปผลการแก้ไขงาน';
    if (c.includes(summaryLabel)) {
        c = c.replace(summaryLabel, tplBlock + '\n\n                   ' + summaryLabel);
    }
}

// 2. Apply Compact Styles to Ticket Cards
c = c.replace(
    /style={{ padding: '24px', borderRadius: '24px', background: 'var\(--bg-card\)', border: '1px solid var\(--border\)', borderLeft: `6px solid \${config.color}`, display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 8px 24px rgba\(0,0,0,0.08\)' }}/,
    "style={{ padding: '12px 16px', borderRadius: '18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `6px solid ${config.color}`, display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}"
);

// Font sizes
c = c.replace(/style={{ fontSize: '16px', fontWeight: '900', color: 'var\(--primary\)', textDecoration: 'none' }}/, "style={{ fontSize: '13px', fontWeight: '900', color: 'var(--primary)', textDecoration: 'none' }}");
c = c.replace(/style={{ fontSize: '14px', fontWeight: '700', lineHeight: '1.5', color: 'var\(--text-main\)', marginBottom: '8px' }}/, "style={{ fontSize: '13px', fontWeight: '700', lineHeight: '1.4', color: 'var(--text-main)', marginBottom: '4px' }}");

// Fix any slash escaping that might happen in previous attempts
c = c.replace(/\\`/g, '`').replace(/\\\$/g, '$');

fs.writeFileSync(path, c, 'utf8');
console.log('✅ SUCCESS: Modal ordered and Cards compacted.');
