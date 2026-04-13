const fs = require('fs');
const path = 'src/app/portal/create/page.tsx';
let lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

// Find handleSubmit
const handleSubmitIndex = lines.findIndex(l => l.includes('const handleSubmit = async'));

if (handleSubmitIndex !== -1) {
  // We want to insert from line 69 onwards
  const newLines = lines.slice(0, handleSubmitIndex + 5); // till return;
  newLines.push('      }');
  newLines.push('      ');
  newLines.push('      setSubmitting(true);');
  newLines.push('      setError(\'\');');
  newLines.push('');
  newLines.push('      try {');
  newLines.push('         // 1. Automatic Ticket Number (Database Trigger handles this)');
  newLines.push('         // 2. Insert Ticket');
  newLines.push('         const ticketPayload: any = {');
  newLines.push('            customer_id: customerData.id,');
  
  // Combine with the rest starting from hospital_id
  const hospitalIndex = lines.findIndex(l => l.includes('hospital_id: customerData.hospital_id,'));
  if (hospitalIndex !== -1) {
    const finalLines = newLines.concat(lines.slice(hospitalIndex));
    fs.writeFileSync(path, finalLines.join('\n'), 'utf8');
    console.log('RECOVERED (v2): Successfully restored code using line markers.');
  } else {
    console.log('Could not find hospital_id line');
  }
} else {
  console.log('Could not find handleSubmit line');
}
