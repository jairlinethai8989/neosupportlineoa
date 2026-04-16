'use client';
import React from 'react';
import { 
  User, 
  Layout, 
  History, 
  CheckCircle, 
  ArrowRight,
  Info 
} from 'lucide-react';

interface TicketSidebarProps {
  selectedChat: any;
  currentTicket: any;
  agent: any;
  viewMode: 'list' | 'chat' | 'details';
  setViewMode: (mode: 'list' | 'chat' | 'details') => void;
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
  if (!selectedChat) return null;

  const isResolved = currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed';
  const isOwner = currentTicket?.assigned_agent_id === agent?.id;
  const isAdmin = agent?.role === 'Administrator';
  const isSessionActive = selectedChat.status === 'active' || selectedChat.is_active;
  const canResolve = currentTicket && !isResolved && (isOwner || isAdmin) && !isSessionActive;

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

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
         <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', opacity: 0.6 }}>
            <Info size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
            Ticket Actions can be found below
         </p>
      </div>
    </div>
  );
};
