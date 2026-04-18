const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// The label text is found - we'll insert a section BEFORE the div containing it
// The div starts with marginBottom: '32px' right before the label
// Find "marginBottom: '32px' }}\r\n                   <label" for resolution summary

const marker = "32px' }}>\r\n                   <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน (Resolution Summary)</label>";

const replacement = `32px' }}>\r\n                   <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>ประเภทงาน</label>\r\n                   <div style={{ position: 'relative', marginBottom: '16px' }}>\r\n                      <select\r\n                        value={selectedIssueType}\r\n                        onChange={(e) => setSelectedIssueType(e.target.value)}\r\n                        style={{\r\n                           width: '100%',\r\n                           padding: '14px 40px 14px 16px',\r\n                           borderRadius: '12px',\r\n                           border: '1px solid var(--border)',\r\n                           background: 'var(--bg-input)',\r\n                           color: 'var(--text-main)',\r\n                           fontSize: '14px',\r\n                           fontWeight: '700',\r\n                           outline: 'none',\r\n                           appearance: 'none',\r\n                           cursor: 'pointer'\r\n                        }}\r\n                      >\r\n                         <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>\r\n                         {availableIssueTypes.map(it => (\r\n                           <option key={it} value={it}>{it}</option>\r\n                         ))}\r\n                      </select>\r\n                   </div>\r\n                   <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน (Resolution Summary)</label>`;

if (c.includes(marker)) {
  c = c.replace(marker, replacement);
  console.log('✅ Issue type dropdown inserted!');
} else {
  // Try without \r
  const marker2 = marker.replace(/\r\n/g, '\n');
  if (c.includes(marker2)) {
    c = c.replace(marker2, replacement.replace(/\r\n/g, '\n'));
    console.log('✅ Inserted (LF version)');
  } else {
    console.log('❌ Still not found. Dumping exact chars around target...');
    const idx = c.indexOf("สรุปผลการแก้ไขงาน (Resolution Summary)");
    console.log(JSON.stringify(c.substring(idx-400, idx)));
  }
}

fs.writeFileSync(path, c, 'utf8');
