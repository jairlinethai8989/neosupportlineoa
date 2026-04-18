const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

const tpl = `
                 {/* 3. เทมเพลตสรุปงาน */}
                 <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                       <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>เทมเพลตสรุปงาน</label>
                       <a href='/settings/profile' target='_blank' rel='noreferrer' style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>จัดการเทมเพลต</a>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                       {personalResTemplates.map((t, idx) => (
                          <button
                             key={idx}
                             type='button'
                             onClick={() => setResSummary(t)}
                             style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'rgba(0, 242, 254, 0.08)', fontSize: '13px', color: 'var(--primary)', cursor: 'pointer', transition: 'all 0.2s' }}
                          >{t}</button>
                       ))}
                       {personalResTemplates.length === 0 && (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ยังไม่ได้ตั้งค่าเทมเพลต — <a href='/settings/profile' target='_blank' rel='noreferrer' style={{ color: 'var(--primary)', textDecoration: 'underline' }}>ตั้งค่าที่นี่</a></p>
                       )}
                    </div>
                 </div>`;

const searchStr = '<label style={{ display: \'block\', fontSize: \'11px\', fontWeight: \'800\', color: \'var(--primary)\', textTransform: \'uppercase\', marginBottom: \'12px\', letterSpacing: \'1px\' }}>สรุปผลการแก้ไขงาน';

if (c.includes(searchStr)) {
    c = c.replace(searchStr, tpl + '\n                    ' + searchStr);
    fs.writeFileSync(path, c, 'utf8');
    console.log('✅ FIXED: Template re-inserted at correct position in tickets/page.tsx');
} else {
    console.log('❌ CSS Label marker not found');
}
