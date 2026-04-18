const fs = require('fs');

// ============================================================
// 1. tickets/[id]/page.tsx
// ============================================================
{
  const path = 'src/app/(dashboard)/tickets/[id]/page.tsx';
  let c = fs.readFileSync(path, 'utf8');

  const startMarker = '<div className="glass" style={{ width: \'100%\', maxWidth: \'440px\', maxHeight: \'90vh\', overflowY: \'auto\', padding: \'32px\', borderRadius: \'32px\', background: \'var(--bg-card)\', boxShadow: \'0 40px 100px rgba(0,0,0,0.6)\', border: \'1px solid var(--border)\', color: \'var(--text-main)\', animation: \'scaleIn 0.3s ease-out\' }}>';
  const endMarker = '<div style={{ display: \'flex\', gap: \'16px\', marginTop: \'auto\' }}>';

  const newContent = `
               <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(54, 153, 255, 0.1)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}><CheckCircle size={28} /></div>
                  <h3 style={{ fontSize: '22px', fontWeight: '900', marginBottom: '6px' }}>ปิดงานใบงาน #{ticket?.ticket_no}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>กรุณาสรุปผลการแก้ไขปัญหาเพื่อแจ้งลูกค้าครับ</p>
               </div>

               {/* 1. Module */}
               <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>Module <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)', fontWeight: '800' }}>
                     <option value="">-- เลือกโมดูล --</option>
                     {availableModules.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
               </div>

               {/* 2. ประเภทงาน */}
               <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>ประเภทงาน <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select value={selectedIssueType} onChange={(e) => setSelectedIssueType(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: '700', border: '1px solid var(--border)', appearance: 'none' }}>
                     <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>
                     {availableIssueTypes.map(it => <option key={it} value={it}>{it}</option>)}
                  </select>
               </div>

               {/* 3. เทมเพลตสรุปงาน */}
               <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                     <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>เทมเพลตสรุปงาน</label>
                     <a href="/settings/profile" target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>จัดการเทมเพลต</a>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {personalResTemplates.map((t, idx) => (
                         <button
                            key={idx}
                            onClick={() => setResSummary(t)}
                            style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'rgba(0, 242, 254, 0.08)', fontSize: '13px', color: 'var(--primary)', cursor: 'pointer', transition: 'all 0.2s' }}
                         >{t}</button>
                      ))}
                      {personalResTemplates.length === 0 && (
                         <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ยังไม่ได้ตั้งค่าเทมเพลต — <a href="/settings/profile" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>ตั้งค่าที่นี่</a></p>
                      )}
                  </div>
               </div>

               {/* 4. สรุปผลการแก้ไขงาน */}
               <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>สรุปผลการแก้ไขงาน (RESOLUTION SUMMARY) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <textarea value={resSummary} onChange={(e) => setResSummary(e.target.value)} placeholder="ระบุรายละเอียดการแก้ไข เช่น 'แก้ไขส่วนลดให้แล้ว'..." style={{ width: '100%', height: '100px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', color: 'var(--text-main)', fontSize: '14px', resize: 'none' }} />
               </div>\n\n               `;

  if (c.includes(startMarker) && c.includes(endMarker)) {
    const parts = c.split(startMarker);
    const middleAndEnd = parts[1].split(endMarker);
    c = parts[0] + startMarker + newContent + endMarker + middleAndEnd[1];
    fs.writeFileSync(path, c, 'utf8');
    console.log('✅ tickets/[id]/page.tsx: Reordered successfully');
  }
}

// ============================================================
// 2. inbox/page.tsx
// ============================================================
{
  const path = 'src/app/(dashboard)/inbox/page.tsx';
  let c = fs.readFileSync(path, 'utf8');

  const startMarker = '<div className="glass" style={{ width: \'100%\', maxWidth: \'480px\', maxHeight: \'90vh\', overflowY: \'auto\', padding: \'32px\', borderRadius: \'32px\', border: \'1px solid var(--border)\', boxShadow: \'0 40px 100px rgba(0,0,0,0.4)\', color: \'var(--text-main)\', background: \'var(--bg-card)\', animation: \'scaleIn 0.3s ease-out\' }}>';
  const endMarker = '<div style={{ display: \'flex\', gap: \'16px\', marginTop: \'auto\' }}>';

  const newContent = `
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                   <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(40, 199, 111, 0.1)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                      <CheckCircle size={32} />
                   </div>
                   <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '8px' }}>ปิดงานใบงาน #{currentTicket?.ticket_no}</h3>
                   <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>กรุณาสรุปผลการแก้ไขปัญหาลิขสิทธิ์</p>
                </div>

                {/* 1. Module */}
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>Module <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)', fontWeight: '800' }}>
                       <option value="">-- เลือกโมดูล --</option>
                       {availableModules.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {/* 2. ประเภทงาน */}
                <div style={{ marginBottom: '24px' }}>
                     <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>ประเภทงาน <span style={{ color: 'var(--danger)' }}>*</span></label>
                     <select value={selectedIssueType} onChange={(e) => setSelectedIssueType(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: '700', border: '1px solid var(--border)', appearance: 'none' }}>
                        <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>
                        {availableIssueTypes.map(it => <option key={it} value={it}>{it}</option>)}
                     </select>
                 </div>

                {/* 3. เทมเพลตสรุปงาน */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                       <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>เทมเพลตสรุปงาน</label>
                       <a href="/settings/profile" target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>จัดการเทมเพลต</a>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {personalResTemplates.map((t, idx) => (
                           <button
                              key={idx}
                              onClick={() => setResSummary(t)}
                              style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'rgba(0, 242, 254, 0.08)', fontSize: '13px', color: 'var(--primary)', cursor: 'pointer', transition: 'all 0.2s' }}
                           >{t}</button>
                        ))}
                        {personalResTemplates.length === 0 && (
                           <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>ยังไม่ได้ตั้งค่าเทมเพลต — <a href="/settings/profile" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>ตั้งค่าที่นี่</a></p>
                        )}
                    </div>
                </div>

                {/* 4. สรุปผลการแก้ไขงาน */}
                <div style={{ marginBottom: '32px' }}>
                   <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>สรุปผลการแก้ไขงาน (RESOLUTION SUMMARY) <span style={{ color: 'var(--danger)' }}>*</span></label>
                   <textarea value={resSummary} onChange={(e) => setResSummary(e.target.value)} placeholder="ระบุรายละเอียดการแก้ไข เช่น 'แก้ไขส่วนลดให้แล้ว'..." style={{ width: '100%', height: '100px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', color: 'var(--text-main)', fontSize: '14px', resize: 'none' }} />
                </div>\n\n                `;

  if (c.includes(startMarker) && c.includes(endMarker)) {
    const parts = c.split(startMarker);
    const middleAndEnd = parts[1].split(endMarker);
    c = parts[0] + startMarker + newContent + endMarker + middleAndEnd[1];
    fs.writeFileSync(path, c, 'utf8');
    console.log('✅ inbox/page.tsx: Reordered successfully');
  }
}

// ============================================================
// 3. tickets/page.tsx (Board View)
// ============================================================
{
  const path = 'src/app/(dashboard)/tickets/page.tsx';
  let c = fs.readFileSync(path, 'utf8');

  const startMarker = 'style={{ width: \'100%\', maxWidth: \'520px\', maxHeight: \'90vh\', overflowY: \'auto\', padding: \'40px\', borderRadius: \'32px\', background: \'var(--bg-card)\', boxShadow: \'0 40px 100px rgba(0,0,0,0.6)\', border: \'1px solid var(--border)\', color: \'var(--text-main)\', animation: \'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)\' }}>';
  const endMarker = '<div style={{ display: \'flex\', gap: \'20px\', marginTop: \'auto\' }}>';

  const newContent = `
                   <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                      <div style={{ width: '72px', height: '72px', borderRadius: '24px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                         <CheckCircle size={36} />
                      </div>
                      <h3 style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '8px' }}>ปิดงานใบงาน #{currentTicket?.ticket_no}</h3>
                      <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>ยืนยันการแก้ไขปัญหาและสรุปผลการทำงาน</p>
                   </div>

                   {/* 1. Module */}
                   <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>Module ที่เกี่ยวข้อง <span style={{ color: '#ef4444' }}>*</span></label>
                      <div style={{ position: 'relative' }}>
                         <select 
                           value={selectedModule} 
                           onChange={(e) => setSelectedModule(e.target.value)}
                           style={{ 
                              width: '100%', 
                              padding: '14px 40px 14px 16px', 
                              borderRadius: '12px', 
                              background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)', 
                              fontSize: '14px', 
                              fontWeight: '800', 
                              outline: 'none',
                              appearance: 'none',
                              cursor: 'pointer',
                              backgroundImage: \`url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")\`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 16px center',
                              backgroundSize: '16px'
                           }}
                         >
                            <option value="" >-- เลือกโมดูล --</option>
                            {availableModules.map(m => (
                              <option key={m} value={m} >{m}</option>
                            ))}
                         </select>
                      </div>
                   </div>

                   {/* 2. ประเภทงาน */}
                   <div style={{ marginBottom: '24px' }}>
                       <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>ประเภทงาน <span style={{ color: 'var(--danger)' }}>*</span></label>
                       <div style={{ position: 'relative' }}>
                          <select
                            value={selectedIssueType}
                            onChange={(e) => setSelectedIssueType(e.target.value)}
                            style={{
                               width: '100%',
                               padding: '14px 40px 14px 16px',
                               borderRadius: '12px',
                               background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)',
                               fontSize: '14px',
                               fontWeight: '800',
                               outline: 'none',
                               appearance: 'none',
                               cursor: 'pointer',
                               backgroundImage: \`url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")\`,
                               backgroundRepeat: 'no-repeat',
                               backgroundPosition: 'right 16px center',
                               backgroundSize: '16px'
                            }}
                          >
                             <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>
                             {availableIssueTypes.map(it => (
                               <option key={it} value={it}>{it}</option>
                             ))}
                          </select>
                       </div>
                   </div>

                   {/* 3. เทมเพลตสรุปงาน */}
                   <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                         <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>เทมเพลตสรุปงาน</label>
                         <a href="/settings/profile" target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>จัดการเทมเพลต</a>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                         {personalResTemplates.map((t, idx) => (
                            <button
                               key={idx}
                               type="button"
                               onClick={() => setResSummary(t)}
                               style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'rgba(0, 242, 254, 0.08)', fontSize: '13px', color: 'var(--primary)', cursor: 'pointer', transition: 'all 0.2s' }}
                            >{t}</button>
                         ))}
                         {personalResTemplates.length === 0 && (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ยังไม่ได้ตั้งค่าเทมเพลต — <a href="/settings/profile" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>ตั้งค่าที่นี่</a></p>
                         )}
                      </div>
                    </div>

                   {/* 4. สรุปผลการแก้ไขงาน */}
                   <div style={{ marginBottom: '32px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน (RESOLUTION SUMMARY) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <textarea 
                      value={resSummary}
                      onChange={(e) => setResSummary(e.target.value)}
                      placeholder="ระบุรายละเอียดสรุปการแก้ไขงาน เพื่อส่งเป็นประวัติให้ลูกค้าทราบ..."
                      style={{ 
                        width: '100%', height: '140px', background: 'var(--bg-input)', border: '1px solid var(--border)', 
                        borderRadius: '20px', padding: '20px', color: 'var(--text-main)', fontSize: '15px', 
                        resize: 'none', transition: 'all 0.2s', outline: 'none'
                      }}
                    />
                   </div>\n\n                   `;

  if (c.includes(startMarker) && c.includes(endMarker)) {
    const parts = c.split(startMarker);
    const middleAndEnd = parts[1].split(endMarker);
    c = parts[0] + startMarker + newContent + endMarker + middleAndEnd[1];
    fs.writeFileSync(path, c, 'utf8');
    console.log('✅ tickets/page.tsx: Reordered successfully');
  }
}

console.log('Done.');
