const fs = require('fs');
const path = 'src/app/portal/create/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /const ticketNo = `TIC-\$\{Math\.floor\(10000 \+ Math\.random\(\) \* 90000\)\}`;/;
const replacement = `const timestamp = Date.now().toString().slice(-6);
          const random = Math.floor(1000 + Math.random() * 9000);
          const ticketNo = \`TIC-\${timestamp}\${random}\`;`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully updated ticket number generation logic');
} else {
  console.log('Regex did not match. Current content check:');
  const lines = content.split('\n');
  const line77 = lines[76]; // 0-indexed
  console.log('Line 77 (raw):', JSON.stringify(line77));
}
