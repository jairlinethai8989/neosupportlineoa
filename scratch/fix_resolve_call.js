const fs = require('fs');
const path = 'src/app/(dashboard)/inbox/page.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(/await ticketService.resolve\(selectedChat.current_ticket_id, agent.id,/g, 'await ticketService.resolve(tId as string, agent?.id,');

fs.writeFileSync(path, c, 'utf8');
console.log('✅ RESOLVE CALL UPDATED: Fixed ID passing');
