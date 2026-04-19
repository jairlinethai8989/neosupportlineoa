import os

file_path = r'd:\Project APP\AntiGravity\neo_line_oa\src\app\(dashboard)\settings\master\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if "{activeTab === 'hospital_depts' && (" in line:
        skip = True
        new_lines.append("                  {/* Unified set - no hospital selection needed */}\n")
        continue
    if skip and 'activeTab ===' not in line and '</select>' in line:
        # Check if the next line ends the block
        pass
    if skip:
        if ')' in line and '&&' not in line and '<button' in line: # safeguard
             skip = False
        if '</select>' in line:
             # Look ahead for the closing )
             continue
        if '        )' in line and '          ' not in line: # rough landing
             skip = False
             continue
        continue
    new_lines.append(line)

# Simpler approach: find the specific lines and comment them out
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target block
target = """                  {activeTab === 'hospital_depts' && (
                    <select
                      value={selectedHospitalId}
                      onChange={e => setSelectedHospitalId(e.target.value)}
                      style={{ flex: 1, minWidth: '150px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', color: 'var(--text-main)', fontSize: '15px', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="">เลือกโรงพยาบาล...</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  )}"""

if target in content:
    print("Found exact match!")
    content = content.replace(target, "                  {/* Unified Mode: No specific hospital selection needed */}")
else:
    print("Exact match not found, trying fuzzy match...")
    # Just remove the two lines with selectedHospitalId
    import re
    content = re.sub(r'value=\{selectedHospitalId\}', 'value=""', content)
    content = re.sub(r'setSelectedHospitalId\(e\.target\.value\)', '() => {}', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Finished.")
