'use client';
import React, { useState } from 'react';
import { 
  User, 
  Layout, 
  History, 
  CheckCircle, 
  ArrowRight,
  Info,
  X,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Hourglass
} from 'lucide-react';
import type { InboxAgent, InboxConversation, InboxTicket, InboxViewMode } from '@/types/inbox';
import { ticketService } from '@/lib/services/ticketService';

interface TicketSidebarProps {
  selectedChat: InboxConversation;
  currentTicket: InboxTicket | null;
  agent: InboxAgent | null;
  viewMode: InboxViewMode;
  setViewMode: (mode: InboxViewMode) => void;
  onFetchGlobalHistory: () => void;
  onResolve: () => void;
  onTransfer: () => void;
  onCloseSession: () => void;
  onCopySurvey: () => void;
}

export const TicketSidebar: React.FC<TicketSidebarProps> = ({
  selectedChat,
  currentTicket,
  agent,
  viewMode,
  setViewMode,
  onFetchGlobalHistory,
  onResolve,
  onTransfer,
  onCloseSession,
  onCopySurvey
}) => {
  const isResolved = currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed';
  const isOwner = currentTicket?.assigned_agent_id === agent?.id;
  const isAdmin = agent?.role === 'Administrator';
  const isSessionActive = !!(selectedChat.status === 'active' || selectedChat.is_active);
  
  const [copied, setCopied] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalationNote, setEscalationNote] = useState('');

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isEscalatedOrPending = currentTicket?.status === 'Escalated' || currentTicket?.status === 'Pending';

  return (
    <div className={`glass inbox-details-panel ${viewMode !== 'details' ? 'hidden-mobile' : ''}`} style={{ width: '360px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
      {/* Customer Meta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={16} color="var(--primary)" />
            <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Customer Meta</h3>
         </div>
         <button onClick={() => setViewMode('chat')} className="show-mobile glass-interactive flex-center" style={{ padding: '8px', borderRadius: '8px', border: 'none' }}>
            <ArrowRight size={18} />
         </button>
      </div>
      
      <div className="glass" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,242,254,0.3)' }}>
               <User size={40} color="#0a0e14" />
            </div>
            <div style={{ textAlign: 'center' }}>
               <p style={{ fontWeight: '800', fontSize: '18px', marginBottom: '4px' }}>{selectedChat.customers?.display_name || 'LINE User'}</p>
               <code style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                  ID: {selectedChat.customers?.line_user_id?.substring(0, 16)}...
               </code>
            </div>
         </div>
      </div>

      {/* Ticket Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
         <Layout size={16} color="var(--primary)" />
         <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Ticket Info</h3>
      </div>
      
      <div className="glass" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
         {currentTicket ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                     <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '4px' }}>TICKET ID</p>
                     <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--primary)' }}>#{currentTicket.ticket_no}</p>
                  </div>
                  <span style={{ 
                     fontSize: '10px', 
                     padding: '4px 10px', 
                     borderRadius: '6px', 
                     background: currentTicket.status === 'Resolved' ? 'var(--success)' : 'var(--primary)',
                     color: 'black',
                     fontWeight: '800'
                  }}>{currentTicket.status}</span>
               </div>
               <div>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '4px' }}>SUBJECT</p>
                  <p style={{ fontSize: '14px', fontWeight: '600', lineHeight: '1.4' }}>{currentTicket.subject}</p>
               </div>
            </div>
         ) : (
            <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>⚠️ การสนทนาทั่วไป (No Ticket)</p>
             </div>
           )}
      </div>

      {/* Ticket Hand-off buttons */}
      {currentTicket && !isResolved && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '900', marginBottom: '4px', textTransform: 'uppercase' }}>Ticket Hand-off</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
             <button 
                onClick={() => setShowEscalateModal(true)}
                disabled={isProcessing || isEscalatedOrPending || !!magicLink}
                className="glass-interactive"
                style={{
                   flex: '1 1 120px',
                   height: '50px',
                   borderRadius: '16px',
                   border: '1px solid #ef4444',
                   background: currentTicket.status === 'Escalated' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.08)',
                   color: '#ef4444',
                   fontWeight: '900',
                   fontSize: '12px',
                   cursor: (isProcessing || isEscalatedOrPending || !!magicLink) ? 'not-allowed' : 'pointer',
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   gap: '8px',
                   boxShadow: '0 4px 15px rgba(239, 68, 68, 0.15)',
                   opacity: (isProcessing || isEscalatedOrPending || !!magicLink) ? 0.6 : 1
                }}
             >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><AlertTriangle size={16} /> Escalate</>}
             </button>

             <button 
                onClick={async () => {
                  if (!window.confirm('ต้องการเปลี่ยนสถานะเป็น Pending (รออุปกรณ์/ติดปัญหาถาวร) ใช่หรือไม่?')) return;
                  setIsProcessing(true);
                  try {
                     await ticketService.updateStatus(currentTicket.id, 'Pending');
                     const link = `${window.location.origin}/escalate/${currentTicket.id}`;
                     setMagicLink(link);
                  } catch (err: any) {
                     alert('Error: ' + err.message);
                  } finally {
                     setIsProcessing(false);
                  }
                }}
                disabled={isProcessing || isEscalatedOrPending || !!magicLink}
                className="glass-interactive"
                style={{
                   flex: '1 1 120px',
                   height: '50px',
                   borderRadius: '16px',
                   border: '1px solid #f59e0b',
                   background: currentTicket.status === 'Pending' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.08)',
                   color: '#f59e0b',
                   fontWeight: '900',
                   fontSize: '12px',
                   cursor: (isProcessing || isEscalatedOrPending || !!magicLink) ? 'not-allowed' : 'pointer',
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   gap: '8px',
                   boxShadow: '0 4px 15px rgba(245, 158, 11, 0.15)',
                   opacity: (isProcessing || isEscalatedOrPending || !!magicLink) ? 0.6 : 1
                }}
             >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><Hourglass size={16} /> Pending</>}
             </button>
          </div>

          {magicLink && (
            <div className="animate-fade-in" style={{ marginTop: '12px', padding: '16px', background: 'var(--bg-input)', borderRadius: '16px', border: '1px dashed var(--primary)' }}>
               <p style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '900', marginBottom: '8px', textTransform: 'uppercase' }}>Magic Link Ready!</p>
               <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input readOnly value={magicLink} style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', outline: 'none' }} />
                  <button onClick={() => handleCopyLink(magicLink)} style={{ background: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
                     {copied ? <CheckCircle2 size={14} color="#000" /> : <Copy size={14} color="#000" />}
                  </button>
               </div>
               <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '8px' }}>
                 <Info size={10} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                 PIN Code: 1234
               </p>
            </div>
          )}
        </div>
      )}

      {/* Global History Link */}
      <button onClick={onFetchGlobalHistory} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', justifyContent: 'center' }}>
         <History size={14} /> <u>ดูประวัติสนทนาเก่าทั้งหมด</u>
      </button>

      {/* End Chat and Resolve buttons at bottom */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
         {isSessionActive && (
            <button onClick={onCloseSession} className="glass-interactive" style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: '800', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
               <X size={18} /> จบการสนทนา (End Chat)
            </button>
         )}

         {currentTicket && !isResolved && (isOwner || isAdmin) && (
            <button 
               onClick={() => {
                  if (isSessionActive) {
                     alert('ต้องจบการสนทนาก่อนจึงจะสามารถปิดงานได้');
                     return;
                  }
                  onResolve();
               }}
               className={isSessionActive ? "" : "glass-interactive"}
               style={{ width: '100%', padding: '16px', borderRadius: '16px', border: 'none', background: isSessionActive ? 'rgba(255,255,255,0.05)' : 'var(--success)', color: isSessionActive ? 'var(--text-muted)' : 'black', fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxShadow: isSessionActive ? 'none' : '0 8px 24px rgba(40, 199, 111, 0.3)', opacity: isSessionActive ? 0.7 : 1 }}
            >
               <CheckCircle size={18} /> ปิดงาน (Resolve Ticket)
            </button>
         )}
      </div>

      {/* Escalation Modal */}
      {showEscalateModal && (
         <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass animate-in zoom-in" style={{ width: '100%', maxWidth: '400px', background: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
               <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                  <AlertCircle color="#ef4444" /> ส่งต่องาน (Escalate)
               </h3>
               <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
                  ระบุรายละเอียดหรือสิ่งที่ต้องการจากแผนกอื่น
               </p>
               <textarea value={escalationNote} onChange={(e) => setEscalationNote(e.target.value)} placeholder="เช่น ตรวจสอบใบเสนอราคา..." style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', marginBottom: '20px', outline: 'none', resize: 'none' }} />
               <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowEscalateModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'none', fontWeight: '700', cursor: 'pointer' }}>ยกเลิก</button>
                  <button disabled={!escalationNote.trim() || isProcessing} onClick={async () => {
                        if (!currentTicket?.id) return;
                        setIsProcessing(true);
                        try {
                           await ticketService.updateStatus(currentTicket.id, 'Escalated', undefined, `[ESCALATION INSTRUCTIONS]: ${escalationNote}`);
                           const link = `${window.location.origin}/escalate/${currentTicket.id}`;
                           setMagicLink(link);
                           handleCopyLink(link);
                           setShowEscalateModal(false);
                           setEscalationNote('');
                        } catch (err: any) {
                           alert('Error: ' + err.message);
                        } finally {
                           setIsProcessing(false);
                        }
                     }} style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: '#ef4444', color: 'white', fontWeight: '800', cursor: 'pointer', opacity: (!escalationNote.trim() || isProcessing) ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                     {isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'ยืนยันการส่งต่องาน'}
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
