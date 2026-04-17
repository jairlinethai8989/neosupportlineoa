import os

filepath = r'd:\Project APP\AntiGravity\neo_line_oa\src\app\(dashboard)\inbox\page.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Correct Block
new_block = [
    '                <div style={{ marginBottom: \'24px\' }}>\n',
    '                    <div style={{ display: \'flex\', justifyContent: \'space-between\', alignItems: \'center\', marginBottom: \'12px\' }}>\n',
    '                       <label style={{ fontSize: \'11px\', fontWeight: \'800\', color: \'var(--primary)\', textTransform: \'uppercase\', letterSpacing: \'1px\' }}>เทมเพลตด่วน</label>\n',
    '                       <button \n',
    '                          onClick={() => setIsManagingTemplates(!isManagingTemplates)}\n',
    '                          style={{ fontSize: \'10px\', color: \'var(--text-muted)\', background: \'none\', border: \'none\', cursor: \'pointer\', textDecoration: \'underline\' }}\n',
    '                       >\n',
    '                          {isManagingTemplates ? \'เสร็จสิ้น\' : \'จัดการเทมเพลต\'}\n',
    '                       </button>\n',
    '                    </div>\n',
    '                    <div style={{ display: \'flex\', gap: \'8px\', flexWrap: \'wrap\' }}>\n',
    '                       {resolutionTemplates.map((t, idx) => (\n',
    '                         <div key={idx} style={{ position: \'relative\', display: \'inline-block\', margin: \'4px\' }}>\n',
    '                            <button \n',
    '                             type="button" \n',
    '                             onClick={() => setResSummary(t)} \n',
    '                             style={{ padding: \'6px 14px\', borderRadius: \'8px\', border: \'1px solid var(--border)\', background: \'rgba(255,255,255,0.05)\', fontSize: \'12px\', color: \'var(--text-muted)\', cursor: \'pointer\' }}\n',
    '                            >\n',
    '                               {t}\n',
    '                            </button>\n',
    '                            {isManagingTemplates && (\n',
    '                               <button \n',
    '                                 onClick={() => removeResTemplate(idx)}\n',
    '                                 style={{ position: \'absolute\', top: \'-8px\', right: \'-8px\', width: \'20px\', height: \'20px\', borderRadius: \'50%\', background: \'var(--danger)\', color: \'white\', border: \'none\', fontSize: \'12px\', cursor: \'pointer\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\' }}\n',
    '                               >\n',
    '                                  ×\n',
    '                               </button>\n',
    '                            )}\n',
    '                         </div>\n',
    '                       ))}\n',
    '                       {resolutionTemplates.length === 0 && !isManagingTemplates && (\n',
    '                          <p style={{ fontSize: \'13px\', color: \'var(--text-muted)\' }}>ยังไม่ได้ตั้งค่าเทมเพลต</p>\n',
    '                       )}\n',
    '                       {isManagingTemplates && (\n',
    '                          <button \n',
    '                            onClick={() => {\n',
    '                               const val = prompt(\'เพิ่มข้อความเทมเพลตใหม่:\');\n',
    '                               if (val) addResTemplate(val);\n',
    '                            }}\n',
    '                            style={{ padding: \'6px 14px\', borderRadius: \'8px\', border: \'1px dashed var(--primary)\', background: \'none\', fontSize: \'12px\', color: \'var(--primary)\', cursor: \'pointer\' }}\n',
    '                          >\n',
    '                             + เพิ่ม\n',
    '                          </button>\n',
    '                       )}\n',
    '                    </div>\n',
    '                </div>\n',
    '\n',
    '                <div style={{ marginBottom: \'24px\' }}>\n',
    '                    <label style={{ display: \'block\', fontSize: \'12px\', fontWeight: \'600\', color: \'rgba(255,255,255,0.6)\', marginBottom: \'8px\' }}>Module <span style={{ color: \'var(--danger)\' }}>*</span></label>\n',
    '                    <div style={{ position: \'relative\' }}>\n',
    '                       <select \n',
    '                         value={selectedModule} \n',
    '                         onChange={(e) => setSelectedModule(e.target.value)}\n',
    '                         style={{ \n',
    '                            width: \'100%\', \n',
    '                            padding: \'14px 40px 14px 16px\', \n',
    '                            borderRadius: \'12px\', \n',
    '                            border: \'none\', \n',
    '                            background: \'linear-gradient(135deg, var(--primary), #00d2ff)\', \n',
    '                            color: \'black\', \n',
    '                            fontSize: \'14px\', \n',
    '                            fontWeight: \'800\', \n',
    '                            outline: \'none\',\n',
    '                            appearance: \'none\',\n',
    '                            cursor: \'pointer\',\n',
    '                            boxShadow: \'0 8px 24px rgba(0,210,254,0.25)\',\n',
    '                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")`,\n',
    '                            backgroundRepeat: \'no-repeat\',\n',
    '                            backgroundPosition: \'right 16px center\',\n',
    '                            backgroundSize: \'16px\'\n',
    '                         }}\n',
    '                       >\n',
    '                          <option value="" style={{ background: \'white\', color: \'black\' }}>-- เลือกโมดูล --</option>\n',
    '                          {availableModules.map(m => (\n',
    '                            <option key={m} value={m} style={{ background: \'white\', color: \'black\' }}>{m}</option>\n',
    '                          ))}\n',
    '                       </select>\n',
    '                    </div>\n',
    '                </div>\n'
]

# We need to find the range to replace.
# Based on the latest view_file:
# Line 781 is empty.
# Line 782 is <div style={{ marginBottom: '24px' }}>
# The corruption goes until line 860.
# Wait, let's be safe. I'll search for the line containing "สรุปผลการแก้ไขงาน" or something similar.

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "h3 style={{ fontSize: '24px'" in line and "CurrentTicket?.ticket_no" in line.lower():
        # This is the header of the modal. The next block starts after this.
        pass
    if i >= 781 and start_idx == -1: # Start at line 782
        start_idx = i
    if "สรุปผลการแก้ไขงาน" in line or "summary" in line.lower() and i > 850:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    lines[start_idx:end_idx] = new_block
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"Replaced lines {start_idx+1} to {end_idx} with clean block.")
else:
    # If logic fails, just use the hardcoded range from view_file observation
    lines[781:860] = new_block
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Replaced lines 782 to 860 by hardcoded range.")
