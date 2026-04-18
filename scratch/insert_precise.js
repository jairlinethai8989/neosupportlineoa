const fs = require('fs');

// ============================================================
// inbox/page.tsx
// ============================================================
{
  const path = 'src/app/(dashboard)/inbox/page.tsx';
  let c = fs.readFileSync(path, 'utf8');

  const exactMarker = `value={m}>{m}</option>)}\n                    </select>\n                </div>\n\n                <div style={{ marginBottom: '32px' }}>\n                   <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>`;
  
  const replacement = `value={m}>{m}</option>)}\n                    </select>\n                </div>\n\n                <div style={{ marginBottom: '24px' }}>\n                     <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>ประเภทงาน</label>\n                     <select value={selectedIssueType} onChange={(e) => setSelectedIssueType(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: '700', border: '1px solid var(--border)', appearance: 'none' }}>\n                        <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>\n                        {availableIssueTypes.map(it => <option key={it} value={it}>{it}</option>)}\n                     </select>\n                 </div>\n\n                <div style={{ marginBottom: '32px' }}>\n                   <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>`;

  if (c.includes(exactMarker)) {
    if (!c.includes('ประเภทงาน')) {
      c = c.replace(exactMarker, replacement);
      console.log('✅ inbox: dropdown inserted');
    } else {
      console.log('inbox: dropdown already exists');
    }
  } else {
    console.warn('❌ inbox: exact marker not found');
  }

  fs.writeFileSync(path, c, 'utf8');
}

// ============================================================
// tickets/[id]/page.tsx
// ============================================================
{
  const path = 'src/app/(dashboard)/tickets/[id]/page.tsx';
  let c = fs.readFileSync(path, 'utf8');

  const exactMarker = `option value="">"-- \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e42\u0e21\u0e14\u0e39\u0e25 --</option>\n                     {availableModules.map(m => <option key={m} value={m}>{m}</option>)}\n                  </select>\n               </div>\n               <div style={{ marginBottom: '24px' }}>\n                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>`;

  if (c.includes(exactMarker)) {
    if (!c.includes('ประเภทงาน')) {
      const replacement = `option value="">"-- เลือกโมดูล --</option>\n                     {availableModules.map(m => <option key={m} value={m}>{m}</option>)}\n                  </select>\n               </div>\n               <div style={{ marginBottom: '24px' }}>\n                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>ประเภทงาน</label>\n                  <select value={selectedIssueType} onChange={(e) => setSelectedIssueType(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: '700', border: '1px solid var(--border)', appearance: 'none' }}>\n                     <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>\n                     {availableIssueTypes.map(it => <option key={it} value={it}>{it}</option>)}\n                  </select>\n               </div>\n               <div style={{ marginBottom: '24px' }}>\n                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>`;
      c = c.replace(exactMarker, replacement);
      console.log('✅ [id]: dropdown inserted');
    } else {
      console.log('[id]: dropdown already exists');
    }
  } else {
    // Use what we know from debug output
    const marker2 = `-- \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e42\u0e21\u0e14\u0e39\u0e25 --</option>\n                     {availableModules.map(m => <option key={m} value={m}>{m}</option>)}\n                  </select>\n               </div>\n               <div style={{ marginBottom: '24px' }}>\n                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>`;
    if (c.includes(marker2)) {
       const replacement2 = `-- เลือกโมดูล --</option>\n                     {availableModules.map(m => <option key={m} value={m}>{m}</option>)}\n                  </select>\n               </div>\n               <div style={{ marginBottom: '24px' }}>\n                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>ประเภทงาน</label>\n                  <select value={selectedIssueType} onChange={(e) => setSelectedIssueType(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: '700', border: '1px solid var(--border)', appearance: 'none' }}>\n                     <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>\n                     {availableIssueTypes.map(it => <option key={it} value={it}>{it}</option>)}\n                  </select>\n               </div>\n               <div style={{ marginBottom: '24px' }}>\n                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>`;
       c = c.replace(marker2, replacement2);
       console.log('✅ [id]: dropdown inserted (alt marker)');
    } else {
      console.warn('❌ [id]: both markers failed');
      // Print the context we know about
      const idx = c.indexOf('สรุปผลการแก้ไขงาน');
      if (idx > 0) {
        console.log('area:', JSON.stringify(c.substring(idx - 500, idx + 100)));
      }
    }
  }

  fs.writeFileSync(path, c, 'utf8');
}

console.log('\n✅ Done!');
