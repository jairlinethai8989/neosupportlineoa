const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Identify the entire Resolve Modal block
const modalStartStr = '{showResolveModal && (';
const modalEndStr = ')}'; // We need to be careful to find the correct ending ) }

const mStart = c.indexOf(modalStartStr);
// Find the closing of showResolveModal block (it ends before <style dangerouslySetInnerHTML)
const mEnd = c.indexOf('<style dangerouslySetInnerHTML', mStart);

if (mStart !== -1 && mEnd !== -1) {
    const originalModal = c.substring(mStart, mEnd);
    
    // 2. Define the CORRECT Modal Structure
    const correctedModal = `{showResolveModal && (
          <div style={{
             position: 'fixed',
             inset: 0,
             zIndex: 10000,
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             background: 'rgba(5, 8, 12, 0.85)',
             backdropFilter: 'blur(20px)',
             padding: '20px'
          }}>
             <div className="glass" style={{
                width: '100%',
                maxWidth: '480px',
                padding: '40px',
                borderRadius: '32px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
                animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                maxHeight: '90vh',
                overflowY: 'auto'
             }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                   <div style={{ 
                     width: '64px', 
                     height: '64px', 
                     borderRadius: '20px', 
                     background: 'rgba(0, 255, 127, 0.1)', 
                     color: 'var(--success)', 
                     display: 'inline-flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     marginBottom: '20px'
                   }}>
                      <CheckCircle size={32} />
                   </div>
                   <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '8px' }}>ปิดงานใบงาน #{resolvingTicket?.ticket_no}</h3>
                   <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>กรุณาสรุปผลการแก้ไขปัญหา เพื่อบันทึกเป็นประวัติและแจ้งลูกค้าครับ</p>
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
                 <div style={{ marginBottom: '32px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>ประเภทงาน <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                       <select
                         value={selectedIssueType}
                         onChange={(e) => setSelectedIssueType(e.target.value)}
                         style={{
                            width: '100%',
                            padding: '14px 40px 14px 16px',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-input)',
                            color: 'var(--text-main)',
                            fontSize: '14px',
                            fontWeight: '700',
                            outline: 'none',
                            appearance: 'none',
                            cursor: 'pointer'
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
                 <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน (RESOLUTION SUMMARY) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <textarea 
                      value={resSummary}
                      onChange={(e) => setResSummary(e.target.value)}
                      placeholder="ระบุรายละเอียดการแก้ไข เช่น 'แก้ไขส่วนลดให้แล้ว', 'อัปเดตสถานะการจัดส่งสำเร็จ'..."
                      style={{
                         width: '100%',
                         height: '140px',
                         background: 'var(--bg-input)',
                         border: '1px solid var(--border)',
                         borderRadius: '16px',
                         padding: '16px',
                         color: 'var(--text-main)',
                         fontSize: '14px',
                         resize: 'none',
                         outline: 'none',
                         transition: 'all 0.3s'
                      }}
                    />
                 </div>

                 <div style={{ display: 'flex', gap: '16px' }}>
                    <button 
                      onClick={() => setShowResolveModal(false)}
                      style={{ flex: 1, padding: '16px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', fontWeight: '800', cursor: 'pointer' }}
                    >
                       ยกเลิก
                    </button>
                    <button 
                      onClick={handleExecuteResolve}
                      disabled={loading || !resSummary.trim() || !selectedModule || !selectedIssueType}
                      style={{ 
                        flex: 1.5, 
                        padding: '16px', 
                        borderRadius: '14px', 
                        border: 'none', 
                        background: (loading || !resSummary.trim() || !selectedModule || !selectedIssueType) ? 'rgba(16, 185, 129, 0.15)' : 'var(--success)', 
                        color: (loading || !resSummary.trim() || !selectedModule || !selectedIssueType) ? 'var(--text-muted)' : 'black', 
                        fontWeight: '900', 
                        cursor: (loading || !resSummary.trim() || !selectedModule || !selectedIssueType) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                      }}
                    >
                       {loading ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> ยืนยันปิดงาน</>}
                    </button>
                 </div>
              </div>
           </div>
        \n       `;

    c = c.replace(originalModal, correctedModal);
    
    // 3. Re-apply the COMPACT styling to the cards (since f67793d didn't have it)
    c = c.replace(
        /style={{ padding: '24px', borderRadius: '24px', background: 'var\(--bg-card\)', border: '1px solid var\(--border\)', borderLeft: \`6px solid \${config.color}\`, display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 8px 24px rgba\(0,0,0,0.08\)' }}/,
        \`style={{ padding: '14px 16px', borderRadius: '18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: \\\`6px solid \${config.color}\\\`, display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}\`
    );
    c = c.replace(/style={{ fontSize: '16px', fontWeight: '900', color: 'var\(--primary\)', textDecoration: 'none' }}/, "style={{ fontSize: '13px', fontWeight: '900', color: 'var(--primary)', textDecoration: 'none' }}");
    c = c.replace(/style={{ fontSize: '14px', fontWeight: '700', lineHeight: '1.5', color: 'var\(--text-main\)', marginBottom: '8px' }}/, "style={{ fontSize: '13px', fontWeight: '700', lineHeight: '1.4', color: 'var(--text-main)', marginBottom: '4px' }}");
    c = c.replace(/style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: \`\${config.color}10\`, borderRadius: '12px', width: 'fit-content', border: \`1px solid \${config.color}20\` }}/g,
        "style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: `\\\${config.color}10`, borderRadius: '8px', width: 'fit-content', border: `1px solid \\\${config.color}20`, fontSize: '10px' }}");
    c = c.replace(/style={{ fontSize: '12px', fontWeight: '600', color: 'var\(--text-muted\)' }}/g, "style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}");
    c = c.replace(/style={{ fontSize: '12px', fontWeight: '800', color: 'var\(--text-main\)' }}/g, "style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-main)' }}");
    c = c.replace(/style={{ fontSize: '13px' }}>{priority}<\/span>/g, "style={{ fontSize: '11px' }}>{priority}</span>");

    fs.writeFileSync(path, c, 'utf8');
    console.log('✅ RECONSTRUCTED & COMPACTED: All fixes applied correctly.');
} else {
    console.log('❌ Modal markers not found');
}
