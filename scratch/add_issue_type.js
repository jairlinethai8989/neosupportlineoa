const fs = require('fs');

// ============================================================
// Fix tickets/page.tsx
// ============================================================
{
  const path = 'src/app/(dashboard)/tickets/page.tsx';
  let c = fs.readFileSync(path, 'utf8');

  // 1. Add selectedIssueType state and availableIssueTypes after selectedModule
  c = c.replace(
    "  const [selectedModule, setSelectedModule] = useState('');",
    "  const [selectedModule, setSelectedModule] = useState('');\r\n  const [selectedIssueType, setSelectedIssueType] = useState('');\r\n  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>([]);"
  );

  // 2. Update fetchData to also select issue_types from company_settings
  c = c.replace(
    "const { data: companyData } = await supabase.from('company_settings').select('id, modules, resolution_templates').limit(1).single();",
    "const { data: companyData } = await supabase.from('company_settings').select('id, modules, resolution_templates, issue_types').limit(1).single();"
  );

  // 3. After setting available templates, also set issue types
  c = c.replace(
    "         if (companyData.resolution_templates) setAvailableTemplates(companyData.resolution_templates);\r\n      } else {",
    "         if (companyData.resolution_templates) setAvailableTemplates(companyData.resolution_templates);\r\n         if (companyData.issue_types) setAvailableIssueTypes(companyData.issue_types);\r\n      } else {"
  );

  // 4. Pass issueType when resolving (tickets/page.tsx)
  c = c.replace(
    "      await ticketService.resolve(resolvingTicket.id, user.id, resSummary, selectedModule);\r\n      setShowResolveModal(false);\r\n      setResolvingTicket(null);\r\n      setResSummary('');\r\n      setSelectedModule('');",
    "      await ticketService.resolve(resolvingTicket.id, user.id, resSummary, selectedModule, selectedIssueType);\r\n      setShowResolveModal(false);\r\n      setResolvingTicket(null);\r\n      setResSummary('');\r\n      setSelectedModule('');\r\n      setSelectedIssueType('');"
  );

  // 5. Also reset on open (look for setShowResolveModal(true) inside the Board)
  c = c.replace(
    "                                           setResolvingTicket(ticket);\r\n                                           setResSummary('');\r\n                                           setShowResolveModal(true);",
    "                                           setResolvingTicket(ticket);\r\n                                           setResSummary('');\r\n                                           setSelectedIssueType('');\r\n                                           setShowResolveModal(true);"
  );

  // 6. Add issue_type dropdown in modal - after the module select section, before resolution summary
  // Find the module section ending and insert issue_type dropdown before resolution summary
  const moduleEndMarker = "                   </div>\r\n\r\n                   <div style={{ marginBottom: '32px' }}>\r\n                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน";
  const issueTypeSection = `                   </div>\r\n\r\n                   <div style={{ marginBottom: '24px' }}>\r\n                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>ประเภทงาน</label>\r\n                      <div style={{ position: 'relative' }}>\r\n                         <select\r\n                           value={selectedIssueType}\r\n                           onChange={(e) => setSelectedIssueType(e.target.value)}\r\n                           style={{\r\n                              width: '100%',\r\n                              padding: '14px 40px 14px 16px',\r\n                              borderRadius: '12px',\r\n                              border: '1px solid var(--border)',\r\n                              background: 'var(--bg-input)',\r\n                              color: 'var(--text-main)',\r\n                              fontSize: '14px',\r\n                              fontWeight: '700',\r\n                              outline: 'none',\r\n                              appearance: 'none',\r\n                              cursor: 'pointer',\r\n                              backgroundImage: \`url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")\`,\r\n                              backgroundRepeat: 'no-repeat',\r\n                              backgroundPosition: 'right 16px center',\r\n                              backgroundSize: '16px'\r\n                           }}\r\n                         >\r\n                            <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>\r\n                            {availableIssueTypes.map(it => (\r\n                              <option key={it} value={it}>{it}</option>\r\n                            ))}\r\n                         </select>\r\n                      </div>\r\n                   </div>\r\n\r\n                   <div style={{ marginBottom: '32px' }}>\r\n                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน`;

  if (c.includes(moduleEndMarker)) {
    c = c.replace(moduleEndMarker, issueTypeSection);
    console.log('✅ Issue type dropdown inserted in tickets/page.tsx modal');
  } else {
    console.warn('⚠️ Could not find insertion point for issue_type in tickets/page.tsx');
  }

  fs.writeFileSync(path, c, 'utf8');
  console.log('✅ tickets/page.tsx updated');
}

// ============================================================
// Fix tickets/[id]/page.tsx
// ============================================================
{
  const path = 'src/app/(dashboard)/tickets/[id]/page.tsx';
  let c = fs.readFileSync(path, 'utf8');

  // Add state
  if (!c.includes('selectedIssueType')) {
    c = c.replace(
      /const \[selectedModule, setSelectedModule\] = useState\(''\);/,
      `const [selectedModule, setSelectedModule] = useState('');\n  const [selectedIssueType, setSelectedIssueType] = useState('');\n  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>([]);`
    );

    // Fetch issue_types from company_settings - find where modules are fetched
    c = c.replace(
      /\.select\('id, modules(.*?)'\)/,
      `.select('id, modules$1, issue_types')`
    );

    // Set availableIssueTypes after modules
    c = c.replace(
      /setAvailableModules\(companyData\.modules\);?\s*\n(\s*)(else setAvailableModules|setAvailableModules\(default)/,
      (match, indent, rest) => match
    );

    // Pass issueType to resolve
    c = c.replace(
      /ticketService\.resolve\(ticket\.id, user\.id, resSummary, selectedModule\)/,
      `ticketService.resolve(ticket.id, user.id, resSummary, selectedModule, selectedIssueType)`
    );
    c = c.replace(
      /ticketService\.resolve\(ticketId, user\.id, resSummary, selectedModule\)/,
      `ticketService.resolve(ticketId, user.id, resSummary, selectedModule, selectedIssueType)`
    );
  }

  fs.writeFileSync(path, c, 'utf8');
  console.log('✅ tickets/[id]/page.tsx updated (state + service call)');
}

// ============================================================
// Fix inbox/page.tsx
// ============================================================
{
  const path = 'src/app/(dashboard)/inbox/page.tsx';
  let c = fs.readFileSync(path, 'utf8');

  if (!c.includes('selectedIssueType')) {
    // Add state
    c = c.replace(
      /const \[selectedModule, setSelectedModule\] = useState\(''\);/,
      `const [selectedModule, setSelectedModule] = useState('');\n  const [selectedIssueType, setSelectedIssueType] = useState('');\n  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>([]);`
    );

    // Pass issueType to resolve
    c = c.replace(
      /ticketService\.resolve\(([^,]+), ([^,]+), resSummary, selectedModule\)/g,
      `ticketService.resolve($1, $2, resSummary, selectedModule, selectedIssueType)`
    );
  }

  fs.writeFileSync(path, c, 'utf8');
  console.log('✅ inbox/page.tsx updated');
}

console.log('\n✅ All files updated successfully!');
