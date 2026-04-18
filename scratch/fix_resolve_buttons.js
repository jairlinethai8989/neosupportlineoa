const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Fix cancel button - use theme vars instead of hardcoded white rgba
c = c.replace(
  "border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)'",
  "border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)'"
);

// 2. Fix disabled confirm button background
c = c.replace(
  "? 'rgba(255,255,255,0.05)' : 'var(--success)'",
  "? 'rgba(16, 185, 129, 0.15)' : 'var(--success)'"
);

// 3. Fix disabled confirm button text color
c = c.replace(
  "? 'rgba(255,255,255,0.2)' : 'black'",
  "? 'var(--text-muted)' : 'black'"
);

// 4. Change button text
c = c.replace('ยืนยันสมบูรณ์', 'ยืนยันปิดงาน');

// 5. Add cursor: not-allowed and transition
c = c.replace(
  "cursor: 'pointer',\r\n                        display: 'flex',\r\n                        alignItems: 'center',\r\n                        justifyContent: 'center',\r\n                        gap: '10px'\r\n                      }}",
  "cursor: (loading || !resSummary.trim() || !selectedModule) ? 'not-allowed' : 'pointer',\r\n                        display: 'flex',\r\n                        alignItems: 'center',\r\n                        justifyContent: 'center',\r\n                        gap: '10px',\r\n                        transition: 'all 0.2s'\r\n                      }}"
);

fs.writeFileSync(path, c, 'utf8');
console.log('✅ Fix applied successfully to tickets/page.tsx');
