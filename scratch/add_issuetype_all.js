const fs = require('fs');

// ============================================================
// inbox/page.tsx - Add issue_types fetch + dropdown in modal
// ============================================================
{
  const path = 'src/app/(dashboard)/inbox/page.tsx';
  let c = fs.readFileSync(path, 'utf8');

  // Check if already has selectedIssueType
  if (c.includes('selectedIssueType')) {
    console.log('inbox: selectedIssueType state already exists');
  } else {
    // Add state after selectedModule
    const stateMarker = "const [selectedModule, setSelectedModule] = useState('');";
    if (c.includes(stateMarker)) {
      c = c.replace(stateMarker,
        `const [selectedModule, setSelectedModule] = useState('');\n  const [selectedIssueType, setSelectedIssueType] = useState('');\n  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>([]);`
      );
      console.log('inbox: added state');
    } else {
      console.warn('inbox: selectedModule state not found');
    }
  }

  // Update company_settings select to include issue_types
  c = c.replace(
    "from('company_settings').select('id, modules, resolution_templates')",
    "from('company_settings').select('id, modules, resolution_templates, issue_types')"
  );

  // Set availableIssueTypes after resolution_templates
  // find where resolution_templates is being set
  c = c.replace(
    /setAvailableModules\(companyData\.modules\);\s*\n(\s*if \(companyData\.resolution_templates\))/,
    (match, next) => {
      return `setAvailableModules(companyData.modules);\n${next}`;
    }
  );
  
  // Add after "if (companyData.resolution_templates) setPersonalResTemplates..." or similar
  // Actually add after the whole company data block - let's find where modules/resolution_templates are assigned
  if (!c.includes('setAvailableIssueTypes(companyData.issue_types)')) {
    // Find a good insertion point
    c = c.replace(
      /if \(companyData\.resolution_templates\) setPersonalResTemplates\(companyData\.resolution_templates\);/,
      `if (companyData.resolution_templates) setPersonalResTemplates(companyData.resolution_templates);\n        if (companyData.issue_types) setAvailableIssueTypes(companyData.issue_types);`
    );
    // Alternative: find modules assignment
    if (!c.includes('setAvailableIssueTypes')) {
      c = c.replace(
        /if \(companyData\.modules.*?setAvailableModules\(companyData\.modules\);/s,
        (match) => match + '\n        if (companyData.issue_types) setAvailableIssueTypes(companyData.issue_types);'
      );
    }
  }

  // Pass issueType to resolve service call
  c = c.replace(
    /ticketService\.resolve\(([^,]+),\s*([^,]+),\s*resSummary,\s*selectedModule\)/g,
    `ticketService.resolve($1, $2, resSummary, selectedModule, selectedIssueType)`
  );

  // Insert dropdown in modal - after module select, before resolution summary
  const moduleEndInbox = `</select>\n                 </div>\n\n                 <div style={{ marginBottom: '32px' }}>\n                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>สรุปผลการแก้ไขงาน (RESOLUTION SUMMARY)`;
  
  if (c.includes(moduleEndInbox)) {
    c = c.replace(moduleEndInbox,
      `</select>\n                 </div>\n\n                 <div style={{ marginBottom: '24px' }}>\n                     <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>ประเภทงาน</label>\n                     <select value={selectedIssueType} onChange={(e) => setSelectedIssueType(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: '700', border: '1px solid var(--border)', appearance: 'none' }}>\n                        <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>\n                        {availableIssueTypes.map(it => <option key={it} value={it}>{it}</option>)}\n                     </select>\n                 </div>\n\n                 <div style={{ marginBottom: '32px' }}>\n                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>สรุปผลการแก้ไขงาน (RESOLUTION SUMMARY)`
    );
    console.log('inbox: dropdown inserted');
  } else {
    // Try to find split
    const idx = c.indexOf('สรุปผลการแก้ไขงาน (RESOLUTION SUMMARY)');
    console.warn('inbox: dropdown insertion point not found. idx=', idx);
    if (idx > 0) console.log('context:', JSON.stringify(c.substring(idx-300, idx)));
  }

  // Reset selectedIssueType when closing modal
  c = c.replace(
    'setShowResolveModal(false);\n      setResSummary(\'\');\n      setSelectedModule(\'\');',
    'setShowResolveModal(false);\n      setResSummary(\'\');\n      setSelectedModule(\'\');\n      setSelectedIssueType(\'\');'
  );

  fs.writeFileSync(path, c, 'utf8');
  console.log('✅ inbox/page.tsx complete');
}

// ============================================================
// tickets/[id]/page.tsx - Add issue_types 
// ============================================================
{
  const path = 'src/app/(dashboard)/tickets/[id]/page.tsx';
  let c = fs.readFileSync(path, 'utf8');

  // Check and add state
  if (!c.includes('selectedIssueType')) {
    c = c.replace(
      /const \[selectedModule, setSelectedModule\] = useState\(''\);/,
      `const [selectedModule, setSelectedModule] = useState('');\n  const [selectedIssueType, setSelectedIssueType] = useState('');\n  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>([]);`
    );
    console.log('[id]: state added');
  }

  // Update fetch
  c = c.replace(
    /from\('company_settings'\)\.select\('id, modules(.*?)'\)/g,
    `from('company_settings').select('id, modules$1, issue_types')`
  );

  // Set availableIssueTypes  
  if (!c.includes('setAvailableIssueTypes')) {
    c = c.replace(
      /if \(companyData\.modules.*?setAvailableModules\([^;]+\);/s,
      (match) => match + '\n      if (companyData?.issue_types) setAvailableIssueTypes(companyData.issue_types);'
    );
    // Alternative: after setAvailableTemplates
    if (!c.includes('setAvailableIssueTypes')) {
      c = c.replace(
        /setAvailableTemplates\([^;]+\);/,
        (match) => match + '\n      if (companyData?.issue_types) setAvailableIssueTypes(companyData.issue_types);'
      );
    }
  }

  // Pass issueType
  c = c.replace(
    /ticketService\.resolve\(([^,]+),\s*([^,]+),\s*resSummary,\s*selectedModule\)/g,
    `ticketService.resolve($1, $2, resSummary, selectedModule, selectedIssueType)`
  );

  // Insert dropdown in modal
  const moduleEndId = `</select>\n               </div>\n            </div>\n\n            <div style={{ marginBottom: '24px' }}>\n               <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>สรุปผลการแก้ไขงาน`;
  if (c.includes(moduleEndId)) {
    c = c.replace(moduleEndId,
      `</select>\n               </div>\n            </div>\n\n            <div style={{ marginBottom: '24px' }}>\n               <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>ประเภทงาน</label>\n               <select value={selectedIssueType} onChange={(e) => setSelectedIssueType(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: '700', border: '1px solid var(--border)', appearance: 'none' }}>\n                  <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>\n                  {availableIssueTypes.map(it => <option key={it} value={it}>{it}</option>)}\n               </select>\n            </div>\n\n            <div style={{ marginBottom: '24px' }}>\n               <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>สรุปผลการแก้ไขงาน`
    );
    console.log('[id]: dropdown inserted');
  } else {
    const idx = c.indexOf('สรุปผลการแก้ไขงาน');
    console.warn('[id]: insert point not found. idx=', idx);
    if (idx > 0) {
      const before = c.substring(idx - 400, idx);
      console.log('Context before:', JSON.stringify(before));
    }
  }

  // Reset on close
  c = c.replace(
    /setShowResolveModal\(false\);\s*\n\s*setResSummary\(''\);\s*\n\s*setSelectedModule\(''\);/,
    `setShowResolveModal(false);\n      setResSummary('');\n      setSelectedModule('');\n      setSelectedIssueType('');`
  );

  fs.writeFileSync(path, c, 'utf8');
  console.log('✅ tickets/[id]/page.tsx complete');
}

console.log('\n✅ All done!');
