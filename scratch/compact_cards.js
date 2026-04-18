const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Shrink the card container
c = c.replace(
    /style={{ padding: '24px', borderRadius: '24px', background: 'var\(--bg-card\)', border: '1px solid var\(--border\)', borderLeft: `6px solid \${config.color}`, display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 8px 24px rgba\(0,0,0,0.08\)' }}/,
    `style={{ padding: '14px 16px', borderRadius: '18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: \\\`6px solid \${config.color}\\\`, display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}`
);

// 2. Shrink Ticket Number and Title
c = c.replace(/style={{ fontSize: '16px', fontWeight: '900', color: 'var\(--primary\)', textDecoration: 'none' }}/, "style={{ fontSize: '13px', fontWeight: '900', color: 'var(--primary)', textDecoration: 'none' }}");
c = c.replace(/style={{ fontSize: '14px', fontWeight: '700', lineHeight: '1.5', color: 'var\(--text-main\)', marginBottom: '8px' }}/, "style={{ fontSize: '13px', fontWeight: '700', lineHeight: '1.4', color: 'var(--text-main)', marginBottom: '4px' }}");

// 3. Shrink specific badges (Hospital and Status)
c = c.replace(/style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: `\${config.color}10`, borderRadius: '12px', width: 'fit-content', border: `1px solid \${config.color}20` }}/g,
    "style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: `\\\${config.color}10`, borderRadius: '8px', width: 'fit-content', border: `1px solid \\\${config.color}20`, fontSize: '10px' }}");

// 4. Shrink User/Hospital text
c = c.replace(/style={{ fontSize: '12px', fontWeight: '600', color: 'var\(--text-muted\)' }}/g, "style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}");
c = c.replace(/style={{ fontSize: '12px', fontWeight: '800', color: 'var\(--text-main\)' }}/g, "style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-main)' }}");

// 5. Shrink priority indicator text
c = c.replace(/style={{ fontSize: '13px' }}>{priority}<\/span>/g, "style={{ fontSize: '11px' }}>{priority}</span>");

fs.writeFileSync(path, c, 'utf8');
console.log('✅ COMPACTED: Ticket cards are now smaller with optimized fonts');
