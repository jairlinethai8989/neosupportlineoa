const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// Insert issue_type dropdown between module section and resolution summary
// The exact divider text between the two sections:
const marker = "                   </div>\r\n\r\n                   <div style={{ marginBottom: '32px' }}>\r\n                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน (Resolution Summary)</label>";

const replacement = `                   </div>\r\n\r\n                   <div style={{ marginBottom: '24px' }}>\r\n                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>ประเภทงาน</label>\r\n                      <div style={{ position: 'relative' }}>\r\n                         <select\r\n                           value={selectedIssueType}\r\n                           onChange={(e) => setSelectedIssueType(e.target.value)}\r\n                           style={{\r\n                              width: '100%',\r\n                              padding: '14px 40px 14px 16px',\r\n                              borderRadius: '12px',\r\n                              border: '1px solid var(--border)',\r\n                              background: 'var(--bg-input)',\r\n                              color: 'var(--text-main)',\r\n                              fontSize: '14px',\r\n                              fontWeight: '700',\r\n                              outline: 'none',\r\n                              appearance: 'none',\r\n                              cursor: 'pointer',\r\n                              backgroundImage: \`url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")\`,\r\n                              backgroundRepeat: 'no-repeat',\r\n                              backgroundPosition: 'right 16px center',\r\n                              backgroundSize: '16px'\r\n                           }}\r\n                         >\r\n                            <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>\r\n                            {availableIssueTypes.map(it => (\r\n                              <option key={it} value={it}>{it}</option>\r\n                            ))}\r\n                         </select>\r\n                      </div>\r\n                   </div>\r\n\r\n                   <div style={{ marginBottom: '32px' }}>\r\n                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน (Resolution Summary)</label>`;

if (c.includes(marker)) {
  c = c.replace(marker, replacement);
  console.log('✅ Issue type dropdown inserted successfully');
} else {
  console.log('❌ Marker not found. Trying alternative...');
  // Try to show what's around line 893-896 content
  const idx = c.indexOf("สรุปผลการแก้ไขงาน (Resolution Summary)");
  console.log('Index of resolution summary label:', idx);
  console.log('Context around it:', JSON.stringify(c.substring(idx - 100, idx + 50)));
}

fs.writeFileSync(path, c, 'utf8');
console.log('Done.');
