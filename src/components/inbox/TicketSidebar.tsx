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
  Loader2
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
  const canResolve = Boolean(currentTicket && !isResolved && (isOwner || isAdmin) && !isSessionActive);

  const [copied, setCopied] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`glass inbox-details-panel ${viewMode !== 'details' ? 'hidden-mobile' : ''}`} style={{ width: '360px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
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
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.6, marginTop: '8px' }}>
                   ลูกค้ายังไม่ได้เปิดใบงาน (Ticket) หรือระบบกำลังประมวลผล...
                </p>
             </div>
          )}
      </div>

      <button 
         onClick={onFetchGlobalHistory}
         style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-muted)', 
            fontSize: '12px', 
            cursor: 'pointer',
            justifyContent: 'center'
         }}
      >
         <History size={14} /> <u>ดูประวัติสนทนาเก่าทั้งหมด (Global Log)</u>
      </button>

      <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', padding: '20px', border: '1px solid var(--border)' }}>
         <h4 style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1.5px', textAlign: 'center' }}>
            Ticket Hand-off
         </h4>
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
               disabled={isProcessing}
               onClick={async () => {
                 if (!currentTicket?.id) return;
                 setIsProcessing(true);
                 try {
                    await ticketService.updateStatus(currentTicket.id, 'Escalated');
                    const link = `${window.location.origin}/escalate/${currentTicket.id}`;
                    setMagicLink(link);
                    handleCopyLink(link);
                 } catch (err: any) {
                    alert('Error: ' + err.message);
                 } finally {
                    setIsProcessing(false);
                 }
               }}
               className="glass-interactive"
               style={{
                  height: '54px',
                  borderRadius: '16px',
                  border: '1px solid var(--secondary, #8b5cf6)',
                  background: 'rgba(139, 92, 246, 0.08)',
                  color: 'var(--secondary, #8b5cf6)',
                  fontWeight: '900',
                  fontSize: '13px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.15)',
                  opacity: isProcessing ? 0.7 : 1
               }}
            >
               {isProcessing ? <Loader2 size={18} className="animate-spin" /> : '🚨 Escalate'}
            </button>
            <button
               disabled={isProcessing}
               onClick={async () => {
                 if (!currentTicket?.id) return;
                 setIsProcessing(true);
                 try {
                    await ticketService.updateStatus(currentTicket.id, 'Pending');
                    const link = `${window.location.origin}/escalate/${currentTicket.id}`;
                    setMagicLink(link);
                    handleCopyLink(link);
                 } catch (err: any) {
                    alert('Error: ' + err.message);
                 } finally {
                    setIsProcessing(false);
                 }
               }}
               className="glass-interactive"
               style={{
                  height: '54px',
                  borderRadius: '16px',
                  border: '1px solid #ef4444',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#ef4444',
                  fontWeight: '900',
                  fontSize: '13px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.15)',
                  opacity: isProcessing ? 0.7 : 1
               }}
            >
               {isProcessing ? <Loader2 size={18} className="animate-spin" /> : '⏳ Pending'}
            </button>
         </div>

         {magicLink && (
           <div className="animate-fade-in" style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-input)', borderRadius: '16px', border: '1px dashed var(--primary)' }}>
              <p style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '900', marginBottom: '8px', textTransform: 'uppercase' }}>Magic Link Ready!</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                 <input 
                    readOnly 
                    value={magicLink} 
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', outline: 'none' }} 
                 />
                 <button 
                    onClick={() => handleCopyLink(magicLink)}
                    style={{ background: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                 >
                    {copied ? <CheckCircle2 size={14} color="#000" /> : <Copy size={14} color="#000" />}
                    <span style={{ fontSize: '10px', fontWeight: '900', color: '#000' }}>{copied ? 'Copied' : 'Copy'}</span>
                 </button>
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '8px' }}>
                <Info size={10} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                PIN Code: 1234
              </p>
           </div>
         )}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
         {isSessionActive && (
            <button 
               onClick={onCloseSession}
               className="glass-interactive"
               style={{ 
                  width: '100%', 
                  padding: '16px', 
                  borderRadius: '16px', 
                  border: '1px solid #ef4444', 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  color: '#ef4444', 
                  fontWeight: '800',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer'
               }}
            >
               <X size={18} /> จบการสนทนา (End Chat)
            </button>
         )}

         {currentTicket && !isResolved && (isOwner || isAdmin) && (
            <button 
               onClick={() => {
                  if (isSessionActive) {
                     alert('ต้องจบการสนทนาก่อนจึงจะสามารถปิดงานได้ (Cannot resolve while chat is active)');
                     return;
                  }
                  onResolve();
               }}
               className={isSessionActive ? "" : "glass-interactive"}
               style={{ 
                  width: '100%', 
                  padding: '16px', 
                  borderRadius: '16px', 
                  border: 'none', 
                  background: isSessionActive ? 'rgba(255,255,255,0.05)' : 'var(--success)', 
                  color: isSessionActive ? 'var(--text-muted)' : 'black', 
                  fontWeight: '900',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isSessionActive ? 'pointer' : 'pointer',
                  boxShadow: isSessionActive ? 'none' : '0 8px 24px rgba(40, 199, 111, 0.3)',
                  opacity: isSessionActive ? 0.7 : 1
               }}
            >
               <CheckCircle size={18} /> ปิดงาน (Resolve Ticket)
            </button>
         )}

         <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', opacity: 0.6 }}>
            <Info size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
            {isSessionActive 
               ? 'ต้องจบการสนทนาก่อนจึงจะสามารถปิดงานได้' 
               : isResolved 
                  ? 'ใบงานนี้ได้รับการแก้ไขเรียบร้อยแล้ว'
                  : 'Ticket Actions can be found above'}
         </p>
      </div>
    </div>
  );
};
