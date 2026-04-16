'use client';
import React from 'react';
import { 
  MessageSquare, 
  Paperclip, 
  Monitor, 
  Loader2, 
  SendHorizontal 
} from 'lucide-react';

interface TicketChatProps {
  messages: any[];
  ticket: any;
  user: any;
  newMessage: string;
  setNewMessage: (msg: string) => void;
  sending: boolean;
  onSendMessage: () => void;
  onAttachFile: () => void;
  onScreenCapture: () => void;
  onEditImage: (url: string) => void;
  onDeleteMessage?: (id: string) => void;
  quickReplies: string[];
}

export const TicketChat: React.FC<TicketChatProps> = ({
  messages,
  ticket,
  user,
  newMessage,
  setNewMessage,
  sending,
  onSendMessage,
  onAttachFile,
  onScreenCapture,
  onEditImage,
  onDeleteMessage,
  quickReplies
}) => {
  if (!ticket) return null;

  const isResolvedOrClosed = ticket.status === 'Resolved' || ticket.status === 'Closed';
  const isNew = ticket.status === 'New';
  const isAssignedToOther = ticket.assigned_agent_id && ticket.assigned_agent_id !== user?.id && user?.role !== 'Administrator';
  const isAdmin = user?.role === 'Administrator';

  return (
    <div className="glass" style={{ padding: '32px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: '600px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Chat Workspace</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(0,255,127,0.1)', borderRadius: '20px' }}>
           <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
           <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '800' }}>LIVE SESSION</span>
        </div>
      </div>
      
      {/* Message History */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '12px' }} className="no-scrollbar">
         {messages.map((msg, idx) => {
            const isOwn = msg.staff_id === user?.id;
            const canDelete = (isOwn || isAdmin) && msg.sender_type === 'agent' && onDeleteMessage;

            return (
              <div key={idx} style={{ 
                alignSelf: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start',
                maxWidth: '75%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start'
              }}>
                 <div style={{ 
                    padding: '12px 18px',
                    borderRadius: '18px',
                    borderTopRightRadius: msg.sender_type === 'agent' ? '4px' : '18px',
                    borderTopLeftRadius: msg.sender_type === 'customer' ? '4px' : '18px',
                    background: msg.sender_type === 'agent' ? 'var(--primary)' : 'var(--secondary)',
                    color: msg.sender_type === 'agent' ? 'black' : 'var(--text)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    position: 'relative'
                 }}>
                    {msg.message_type === 'image' || msg.content?.includes('supabase.co/storage') ? (
                       <img 
                          src={msg.content} 
                          alt="attachment" 
                          onClick={() => onEditImage(msg.content)}
                          title="คลิกเพื่อแก้ไขและวาดรูป"
                          style={{ maxWidth: '280px', borderRadius: '8px', cursor: 'pointer', objectFit: 'cover' }} 
                       />
                    ) : (
                       <p style={{ fontSize: '14px', fontWeight: msg.sender_type === 'agent' ? '700' : '500', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    )}
                    
                    {canDelete && (
                      <button 
                        onClick={() => onDeleteMessage && onDeleteMessage(msg.id)}
                        className="glass-interactive flex-center"
                        style={{
                          position: 'absolute',
                          right: '-10px',
                          top: '-10px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'rgba(255, 68, 68, 0.9)',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(255, 68, 68, 0.3)',
                          display: 'none', // Shown on hover via CSS if possible, or always
                          zIndex: 10
                        }}
                        title="Unsend"
                      >
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                      </button>
                    )}
                 </div>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    {msg.sender_type === 'agent' && ' • Sent by you'}
                    {canDelete && (
                       <span 
                         onClick={() => onDeleteMessage && onDeleteMessage(msg.id)}
                         style={{ color: 'var(--danger)', cursor: 'pointer', marginLeft: '8px', textDecoration: 'underline' }}>
                         Unsend
                       </span>
                    )}
                 </p>
              </div>
            );
         })}
         {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '100px', opacity: 0.3 }}>
               <MessageSquare size={48} style={{ marginBottom: '16px' }} />
               <p style={{ fontSize: '16px', fontWeight: '800' }}>No messages yet</p>
               <p style={{ fontSize: '12px' }}>Start supporting your customer</p>
            </div>
         )}
      </div>

      {/* Input Area */}
      <div style={{ marginTop: 'auto' }}>
         {/* Quick Replies */}
         {!isResolvedOrClosed && !isNew && (
          <div className="no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '4px' }}>
              {quickReplies.map((qr, idx) => (
                <button 
                  key={idx}
                  onClick={() => setNewMessage(newMessage ? newMessage + ' ' + qr : qr)}
                  className="glass-interactive"
                  style={{ whiteSpace: 'nowrap', padding: '6px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {qr.substring(0, 30)}...
                </button>
              ))}
          </div>
         )}
         
         {isNew ? (
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255, 171, 0, 0.05)', border: '1px dotted var(--warning)', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--warning)', fontWeight: '800' }}>
                 ⚠️ กรุณากด "รับงาน (Claim)" เพื่อเริ่มต้นการพูดคุยกับลูกค้า
              </p>
            </div>
          ) : isAssignedToOther ? (
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.05)', border: '1px dotted var(--border)', textAlign: 'center' }}>
               <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '800' }}>
                  🔐 ใบงานนี้มีผู้ดูแลแล้ว (Read Only)
               </p>
            </div>
          ) : (isResolvedOrClosed && !isAdmin) ? (
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(0, 255, 127, 0.05)', border: '1px dotted var(--success)', textAlign: 'center' }}>
               <p style={{ fontSize: '13px', color: 'var(--success)', fontWeight: '800' }}>
                  ✅ ใบงานนี้เสร็จสมบูรณ์แล้ว ระบบปิดการสนทนาขอบคุณที่ใช้บริการครับ
               </p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '16px', border: '1px solid var(--border)', alignItems: 'center' }}>
               <button 
                  onClick={onAttachFile}
                  disabled={sending}
                  className="glass-interactive flex-center" 
                  title="แนบไฟล์รูปภาพ"
                  style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}>
                  <Paperclip size={18} />
               </button>
               <button 
                  onClick={onScreenCapture}
                  disabled={sending}
                  className="glass-interactive flex-center" 
                  title="จับภาพหน้าจอ (Capture Screen)"
                  style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}>
                  <Monitor size={18} />
               </button>
               <input 
                  type="text" 
                  placeholder={isResolvedOrClosed ? "ใบงานปิดแล้ว (Admin Re-open Mode)" : "Type your response or select a template..."} 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && onSendMessage()}
                  style={{ flex: 1, background: 'transparent', border: 'none', padding: '12px', color: 'var(--text)', fontSize: '14px', fontWeight: '500', outline: 'none' }}
               />
               <button 
                onClick={onSendMessage}
                disabled={sending || !newMessage.trim()}
                className="glass-interactive flex-center" 
                style={{ width: '48px', height: '48px', borderRadius: '12px', border: 'none', background: (!newMessage.trim() && !sending) ? 'rgba(255,255,255,0.05)' : 'var(--primary)', color: (!newMessage.trim() && !sending) ? 'var(--text-muted)' : 'black', transition: 'all 0.3s' }}>
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={20} />}
               </button>
            </div>
          )}
      </div>
    </div>
  );
};
