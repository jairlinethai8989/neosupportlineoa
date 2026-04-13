'use client';
import React from 'react';
import { 
  ArrowLeft, 
  Info, 
  Loader2, 
  Send, 
  Paperclip, 
  MessageSquare, 
  Plus, 
  Pencil, 
  Trash2, 
  Clock,
  AlertTriangle 
} from 'lucide-react';

interface ChatWindowProps {
  selectedChat: any;
  messages: any[];
  newMessage: string;
  setNewMessage: (msg: string) => void;
  sending: boolean;
  onSendMessage: (e: React.FormEvent) => void;
  viewMode: 'list' | 'chat' | 'details';
  setViewMode: (mode: 'list' | 'chat' | 'details') => void;
  currentTicket: any;
  agent: any;
  showCanned: boolean;
  setShowCanned: (show: boolean) => void;
  cannedResponses: string[];
  onAddCanned: () => void;
  onEditCanned: (idx: number) => void;
  onDeleteCanned: (idx: number) => void;
  onUseCanned: (text: string) => void;
  onAttachClick: () => void;
  onEditImage: (url: string) => void;
  onClaim: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  selectedChat,
  messages,
  newMessage,
  setNewMessage,
  sending,
  onSendMessage,
  viewMode,
  setViewMode,
  currentTicket,
  agent,
  showCanned,
  setShowCanned,
  cannedResponses,
  onAddCanned,
  onEditCanned,
  onDeleteCanned,
  onUseCanned,
  onAttachClick,
  onEditImage,
  onClaim,
  messagesEndRef
}) => {
  if (!selectedChat) {
    return (
      <div className="glass inbox-chat-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '20px' }}>
          <div className="glass" style={{ width: '120px', height: '120px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)' }}>
             <MessageSquare size={48} color="var(--border)" style={{ opacity: 0.3 }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>กล่องแชทส่วนกลาง</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '300px', fontSize: '14px' }}>เลือกการสนทนาทางด้านซ้ายเพื่อเริ่มต้นพูดคุยกับลูกค้าแบบ Real-time</p>
          </div>
        </div>
      </div>
    );
  }

  const isResolved = currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed';
  const isViewOnly = agent?.role !== 'Administrator' && agent?.permissions?.inbox === 'view';
  const isUnassigned = currentTicket && !currentTicket.assigned_agent_id;
  const isRestricted = (currentTicket && !currentTicket.assigned_agent_id && agent?.role !== 'Administrator');

  return (
    <div className={`glass inbox-chat-panel ${viewMode !== 'chat' ? 'hidden-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-topbar)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <button 
            onClick={() => setViewMode('list')}
            aria-label="Back to conversations"
            className="show-mobile glass-interactive flex-center" style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--border)', marginRight: '8px' }}>
              <ArrowLeft size={18} aria-hidden="true" />
           </button>
           <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#0a0e14', boxShadow: '0 4px 12px rgba(0,242,254,0.2)' }}>
              {selectedChat.customers?.display_name?.charAt(0) || 'L'}
           </div>
           <div>
              <p style={{ fontWeight: '800', fontSize: '16px' }}>{selectedChat.customers?.display_name || 'LINE User'}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
                <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700', textTransform: 'uppercase' }}>Active Session</span>
              </div>
           </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
           <button 
            onClick={() => setViewMode('details')}
            className="show-mobile glass-interactive flex-center" style={{ width: '38px', height: '38px', borderRadius: '10px', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <Info size={18} aria-hidden="true" />
           </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }} className="no-scrollbar">
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '14px' }}>กำลังรอข้อความใหม่…</p>
          </div>
        )}
        {messages.map((msg) => (
           <div key={msg.id} style={{ alignSelf: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <div style={{ 
                 padding: '12px 18px', 
                 borderRadius: msg.sender_type === 'agent' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
                 background: msg.sender_type === 'agent' ? 'var(--secondary)' : (msg.sender_type === 'system' ? 'var(--bg-input)' : 'var(--bg-card)'),
                 border: '1px solid ' + (msg.sender_type === 'agent' ? 'rgba(115, 103, 240, 0.2)' : 'var(--border)'),
                 fontSize: '14px',
                 lineHeight: '1.6',
                 boxShadow: msg.sender_type === 'agent' ? '0 4px 15px rgba(115, 103, 240, 0.2)' : 'none',
                 color: msg.sender_type === 'system' ? 'var(--primary)' : 'white'
              }}>
                 {msg.content && (msg.message_type === 'image' || (String(msg.content).startsWith('http') && String(msg.content).match(/\.(jpeg|jpg|gif|png|webp|JPG|PNG)$/i))) ? (
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '10px' }}>
                       <img 
                          src={msg.content} 
                          style={{ maxWidth: '100%', borderRadius: '10px', display: 'block', cursor: 'pointer' }} 
                          onClick={() => onEditImage(msg.content)}
                          alt="Chat attachment" 
                          title="คลิกเพื่อทำการแก้ไขภาพ (Edit/Draw)"
                       />
                    </div>
                 ) : msg.message_type === 'file' || (msg.content?.startsWith('http') && msg.message_type !== 'text') ? (
                    <a href={msg.content} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>
                       <Clock size={16} /> ดูไฟล์แนบ
                    </a>
                 ) : (
                    msg.content
                 )}
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', textAlign: msg.sender_type === 'agent' ? 'right' : 'left', opacity: 0.7 }}>
                 {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </p>
           </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-topbar)', position: 'relative' }}>
        {showCanned && (
          <div className="glass animate-fade-in" style={{ position: 'absolute', bottom: '100%', left: '24px', right: '24px', marginBottom: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 -10px 25px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
              <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>ข้อความสำเร็จรูป (QUICK REPLIES)</p>
              <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); onAddCanned(); }} 
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800' }}>
                 <Plus size={12} /> เพิ่มใหม่
              </button>
            </div>
            {cannedResponses.map((res, i) => (
              <div key={i} style={{ display: 'flex', gap: '4px' }}>
                <button 
                  type="button" 
                  onClick={(e) => { e.preventDefault(); onUseCanned(res); }} 
                  className="glass-interactive" 
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid transparent', color: 'var(--text-main)', fontSize: '13px', textAlign: 'left', transition: 'all 0.2s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {res}
                </button>
                <button 
                  type="button" 
                  onClick={(e) => { e.preventDefault(); onEditCanned(i); }} 
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}><Pencil size={14} /></button>
                <button 
                  type="button" 
                  onClick={(e) => { e.preventDefault(); onDeleteCanned(i); }} 
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '8px' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
         {isUnassigned && (
            <div className="glass animate-fade-in" style={{ padding: '12px 20px', background: 'rgba(255, 120, 0, 0.1)', border: '1px solid rgba(255,120,0,0.2)', borderRadius: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <AlertTriangle size={16} color="#ff9f43" />
                 <p style={{ fontSize: '13px', color: '#ff9f43', fontWeight: '800' }}>ใบงานยังไม่มีผู้ดูแล</p>
              </div>
              <button 
                onClick={onClaim}
                style={{ padding: '6px 16px', borderRadius: '8px', background: 'var(--primary)', color: 'black', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
              >
                 กดรับงาน (Claim)
              </button>
            </div>
         )}
         <form onSubmit={onSendMessage}>
          <div className="glass" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-input)', borderRadius: '14px', border: '1px solid var(--border)' }}>
             <button type="button" onClick={() => setShowCanned(!showCanned)} aria-label="Quick replies" className="glass-interactive flex-center" style={{ width: '36px', height: '36px', background: 'none', border: 'none', color: showCanned ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}><MessageSquare size={19} aria-hidden="true" /></button>
             <button type="button" onClick={onAttachClick} aria-label="Attach file" className="glass-interactive flex-center" style={{ width: '36px', height: '36px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Paperclip size={20} aria-hidden="true" /></button>
           <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                 isResolved 
                   ? "ใบงานถูกปิดแล้ว (Read Only)" 
                   : isViewOnly 
                     ? "คุณมีสิทธิ์อ่านเท่านั้น (View Only)" 
                     : isRestricted
                       ? "กรุณากดรับงานก่อนเริ่มการสนทนา"
                       : "พิมพ์ข้อความตอบกลับ..."
               } 
              disabled={isResolved || isViewOnly || isRestricted}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-main)', padding: '12px 0', fontSize: '14px', opacity: (isResolved || isRestricted) ? 0.4 : 1 }}
           />
           <button 
             type="submit"
             disabled={sending || !newMessage.trim() || isResolved || isRestricted}
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
               opacity: (sending || !newMessage.trim() || isResolved || isRestricted) ? 0.4 : 1 
             }}>
              {sending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
           </button>
        </div>
      </form>
    </div>
  </div>
  );
};
