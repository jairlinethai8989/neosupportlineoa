const fs = require('fs');
const filePath = 'd:/Project APP/AntiGravity/neo_line_oa/src/app/portal/tickets/[id]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = 'สถานะปัจจุบัน';
const targetIndex = content.indexOf(targetStr);

if (targetIndex !== -1) {
  // Let's find the start of the section
  const sectionStartStr = '<section className="portal-glass"';
  const sectionStartIndex = content.lastIndexOf(sectionStartStr, targetIndex);
  
  // Let's find the end of the div containing the status
  const divEndStr = '</div>';
  const divEndIndex = content.indexOf(divEndStr, targetIndex + targetStr.length);
  
  if (sectionStartIndex !== -1 && divEndIndex !== -1) {
    const startPart = content.substring(0, sectionStartIndex);
    const endPart = content.substring(divEndIndex + divEndStr.length);
    
    const newStatusBlock = `<section className="portal-glass" style={{ padding: '24px', marginBottom: '24px', background: 'white', border: '1px solid var(--portal-border)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>สถานะปัจจุบัน</h3>
              <span style={{ 
                fontSize: '13px', 
                fontWeight: '900', 
                color: ['resolved', 'closed'].includes(String(ticket.status).toLowerCase()) 
                  ? '#22c55e' 
                  : String(ticket.status).toLowerCase() === 'pending'
                    ? '#f97316'
                    : 'var(--portal-primary)' 
              }}>
                 {getFriendlyStatus()}
              </span>
           </div>

           {String(ticket.status).toLowerCase() === 'pending' && (
             <div style={{
               padding: '12px 16px',
               borderRadius: '12px',
               background: '#fff7ed',
               border: '1px solid #ffedd5',
               color: '#c2410c',
               fontSize: '13px',
               fontWeight: '700',
               marginBottom: '16px',
               display: 'flex',
               alignItems: 'center',
               gap: '8px'
             }}>
               <span style={{ fontSize: '16px' }}>⚠️</span>
               <span>ใบงานนี้ติดปัญหาชั่วคราว (Pending) - เจ้าหน้าที่อยู่ระหว่างการรอข้อมูลเพิ่มเติมหรือกำลังแก้ไขอย่างเร่งด่วน</span>
             </div>
           )}`;
           
    fs.writeFileSync(filePath, startPart + newStatusBlock + endPart, 'utf8');
    console.log('Successfully replaced status block!');
  } else {
    console.log('Could not find section start or div end');
  }
} else {
  console.log('Could not find target string');
}
