const fs = require('fs');
const path = 'src/app/(dashboard)/inbox/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update placeholder - Collaborative mode
const newPlaceholder = `placeholder={
                       (currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed') 
                         ? "ใบงานถูกปิดแล้ว (Read Only)" 
                         : (agent?.role !== 'Administrator' && agent?.permissions?.inbox === 'view') 
                           ? "คุณมีสิทธิ์อ่านเท่านั้น (View Only)" 
                           : (currentTicket && !currentTicket.assigned_agent_id && agent?.role !== 'Administrator')
                             ? "กรุณากดรับงานก่อนเริ่มการสนทนา"
                             : "พิมพ์ข้อความตอบกลับ..."
                     }`;

content = content.replace(/placeholder=\{.*?\}/s, newPlaceholder);

// 2. Update Disabled logic - Open for all if assigned
const newDisabled = `disabled={
                       currentTicket?.status === 'Resolved' || 
                       currentTicket?.status === 'Closed' ||
                       (agent?.role !== 'Administrator' && agent?.permissions?.inbox === 'view') ||
                       (currentTicket && !currentTicket.assigned_agent_id && agent?.role !== 'Administrator')
                     }`;

content = content.replace(/disabled=\{.*?currentTicket\?\.status === .Resolved. \|\|.*?currentTicket\?\.status === .Closed. \|\|.*?\(agent\?\.role !== .Administrator. && agent\?\.permissions\?\.inbox === .view.\).*?\}/s, newDisabled);

// 3. Update Opacity
const newStyle = `style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-main)', padding: '12px 0', fontSize: '14px', opacity: (currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed' || (currentTicket && !currentTicket.assigned_agent_id && agent?.role !== 'Administrator')) ? 0.4 : 1 }}`;
content = content.replace(/style=\{\{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var\(--text-main\)', padding: '12px 0', fontSize: '14px', opacity: \(currentTicket\?\.status === .Resolved. \|\| currentTicket\?\.status === .Closed. \|\| \(currentTicket && !currentTicket\.assigned_agent_id\)\) \? 0\.4 : 1 \}\}/s, newStyle);

// 4. Update Send Button
const newButton = `<button 
                   type="submit"
                   disabled={sending || !newMessage.trim() || currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed' || (currentTicket && !currentTicket.assigned_agent_id && agent?.role !== 'Administrator')}
                   style={{ 
                     background: 'var(--primary)', 
                     border: 'none', 
                     color: '#0a0e14', 
                     width: '42px', 
                     height: '36px', 
                     borderRadius: '10px', 
                     display: 'flex', 
                     alignItems: 'center', 
                     justifyContent: 'center', 
                     cursor: 'pointer',
                     transition: 'all 0.2s',
                     opacity: (sending || !newMessage.trim() || currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed' || (currentTicket && !currentTicket.assigned_agent_id && agent?.role !== 'Administrator')) ? 0.4 : 1 
                   }}>`;

content = content.replace(/<button\s+type=\"submit\".*?opacity: \(sending \|\| !newMessage\.trim\(\) \|\| currentTicket\?\.status === .Resolved. \|\| currentTicket\?\.status === .Closed. \|\| \(currentTicket && !currentTicket\.assigned_agent_id\)\) \? 0\.4 : 1\s+\}\}>/s, newButton);

// 5. Hard-lock handleSendMessage
const lockCheck = `    // Collaborative Locking Logic
    const isUnassigned = currentTicket && !currentTicket.assigned_agent_id;
    const isResolved = currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed';
    const isAdmin = agent?.role === 'Administrator';

    if ((isResolved || isUnassigned) && !isAdmin) {
       alert(isResolved ? 'ใบงานนี้ถูกปิดแล้ว' : 'กรุณากดรับงานก่อนเริ่มการสนทนาครับ');
       return;
    }`;

// Inject before currentMsg line
content = content.replace(/const currentMsg = newMessage;/s, lockCheck + "\n\n    const currentMsg = newMessage;");

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully applied collaborative chat logic to inbox/page.tsx');
