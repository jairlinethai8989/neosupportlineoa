import os

filepath = r'd:\Project APP\AntiGravity\neo_line_oa\src\app\(dashboard)\inbox\page.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# I will find the block starting from the first "จัดการเทมเพลต" and ending before "สรุปผลการแก้ไขงาน"
# and completely replace it with a clean version.

import re

# Identify the problematic block. It starts around line 785 in the current version.
pattern = re.compile(r'(\s+<button\s+onClick=\{\(\) => setIsManagingTemplates\(!isManagingTemplates\)\}[\s\S]+?)([\s\S]+?)(\s+<div style=\{\{ marginBottom: \'32px\' \}\}>)', re.DOTALL)

# Let's find matches
matches = pattern.findall(content)

clean_block = r'''                       <button 
                          onClick={() => setIsManagingTemplates(!isManagingTemplates)}
                          style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                       >
                          {isManagingTemplates ? 'เสร็จสิ้น' : 'จัดการเทมเพลต'}
                       </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                       {resolutionTemplates.map((t, idx) => (
                         <div key={idx} style={{ position: 'relative' }}>
                            <button 
                             type="button" 
                             onClick={() => setResSummary(t)} 
                             style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                               {t}
                            </button>
                            {isManagingTemplates && (
                               <button 
                                 onClick={() => removeResTemplate(idx)}
                                 style={{ position: 'absolute', top: '-8px', right: '-8px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--danger)', color: 'white', border: 'none', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                               >
                                  ×
                               </button>
                            )}
                         </div>
                       ))}
                       {resolutionTemplates.length === 0 && !isManagingTemplates && (
                          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>ยังไม่ได้ตั้งค่าเทมเพลต</p>
                       )}
                       {isManagingTemplates && (
                          <button 
                            onClick={() => {
                               const val = prompt('เพิ่มข้อความเทมเพลตใหม่:');
                               if (val) addResTemplate(val);
                            }}
                            style={{ padding: '6px 14px', borderRadius: '8px', border: '1px dashed var(--primary)', background: 'none', fontSize: '12px', color: 'var(--primary)', cursor: 'pointer' }}
                          >
                             + เพิ่ม
                          </button>
                       )}
                    </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Module <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                       <select 
                         value={selectedModule} 
                         onChange={(e) => setSelectedModule(e.target.value)}
                         style={{ 
                            width: '100%', 
                            padding: '14px 40px 14px 16px', 
                            borderRadius: '12px', 
                            border: 'none', 
                            background: 'linear-gradient(135deg, var(--primary), #00d2ff)', 
                            color: 'black', 
                            fontSize: '14px', 
                            fontWeight: '800', 
                            outline: 'none',
                            appearance: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 8px 24px rgba(0,210,254,0.25)',
                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 16px center',
                            backgroundSize: '16px'
                         }}
                       >
                          <option value="" style={{ background: 'white', color: 'black' }}>-- เลือกโมดูล --</option>
                          {availableModules.map(m => (
                            <option key={m} value={m} style={{ background: 'white', color: 'black' }}>{m}</option>
                          ))}
                       </select>
                    </div>
                </div>

'''

# We want to replace the part that was corrupted.
# Based on the view_file, there's a big block that's messed up.
# I'll just replace the whole Resolve Modal interior for safety.

modal_pattern = re.compile(r'(<div style=\{\{ textAlign: \'center\', marginBottom: \'32px\' \}\}>[\s\S]+?)(<div style=\{\{ display: \'flex\', justifyContent: \'space-between\', gap: \'12px\' \}\}>)', re.DOTALL)

def replacement(match):
    return match.group(1) + clean_block + match.group(2)

new_content = modal_pattern.sub(replacement, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Fix applied successfully.")
