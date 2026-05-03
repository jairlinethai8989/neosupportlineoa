'use client';
/* eslint-disable @next/next/no-img-element */
import React, { type FormEvent, type RefObject } from 'react';
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
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import type {
  InboxAgent,
  InboxConversation,
  InboxMessage,
  InboxTicket,
  InboxViewMode,
} from '@/types/inbox';

interface ChatWindowProps {
  selectedChat: InboxConversation;
  messages: InboxMessage[];
  newMessage: string;
  setNewMessage: (msg: string) => void;
  sending: boolean;
  onSendMessage: (e: FormEvent<HTMLFormElement>) => void;
  viewMode: InboxViewMode;
  setViewMode: (mode: InboxViewMode) => void;
  currentTicket: InboxTicket | null;
  agent: InboxAgent | null;
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
  onDeleteMessage?: (id: string) => void | Promise<void>;
  hasMoreMessages: boolean;
  loadingMoreMessages: boolean;
  onLoadOlderMessages: () => Promise<void>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
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
  onDeleteMessage,
  hasMoreMessages,
  loadingMoreMessages,
  onLoadOlderMessages,
  messagesEndRef
}) => {
  const { t } = useStaffLocale();
  if (!selectedChat) {
    return (
      <div className="glass inbox-chat-panel animate-page-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '24px' }}>
          <div className="glass flex-center" style={{ width: '140px', height: '140px', borderRadius: '40px', background: 'rgba(54, 153, 255, 0.03)', border: '1px solid var(--border)', position: 'relative' }}>
             <MessageSquare size={56} color="var(--primary)" style={{ opacity: 0.4 }} />
             <div className="skeleton" style={{ position: 'absolute', bottom: '-10px', width: '80%', height: '8px', opacity: 0.2 }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '22px', fontWeight: '900', marginBottom: '8px', letterSpacing: '-0.5px' }}>NeoSupport Central Hub</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '340px', fontSize: '14px', lineHeight: '1.6' }}>{t('inbox.selectChatSubtitle')}</p>
          </div>
        </div>
      </div>
    );
  }

  const isResolved = currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed';
  const isViewOnly = !!(agent?.role !== 'Administrator' && agent?.permissions?.inbox === 'view');
  const isUnassigned = !!(currentTicket && !currentTicket.assigned_agent_id);
  const isRestricted = !!(currentTicket && !currentTicket.assigned_agent_id && agent?.role !== 'Administrator');
  const normalizedConversationStatus = String(selectedChat.status || '')
    .toLowerCase()
    .trim();
  const isSessionActive =
    selectedChat.is_active === true ||
    ['active', 'open', 'new', 'in progress', 'in_progress'].includes(
      normalizedConversationStatus
    );

  const handleMessagesScroll = async (
    event: React.UIEvent<HTMLDivElement>
  ) => {
    const target = event.currentTarget;
    if (!hasMoreMessages || loadingMoreMessages || target.scrollTop > 60) return;

    const prevScrollTop = target.scrollTop;
    const prevScrollHeight = target.scrollHeight;
    await onLoadOlderMessages();

    requestAnimationFrame(() => {
      const nextScrollHeight = target.scrollHeight;
      target.scrollTop = nextScrollHeight - prevScrollHeight + prevScrollTop;
    });
  };

  return (
    <div data-capture-root="true" className={`glass inbox-chat-panel ${viewMode !== 'chat' ? 'hidden-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: isSessionActive ? 'var(--success)' : 'var(--text-muted)',
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    color: isSessionActive ? 'var(--success)' : 'var(--text-muted)',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                  }}
                >
                  {isSessionActive ? (t('inbox.activeSession') || 'Active Session') : (t('inbox.closedSession') || 'Closed Session')}
                </span>
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

      <div
        style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}
        className="no-scrollbar"
        onScroll={handleMessagesScroll}
      >
        {(hasMoreMessages || loadingMoreMessages) && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            {loadingMoreMessages ? (t('inbox.loadingOlderMessages') || 'Loading older messages...') : (t('inbox.scrollToLoadOlder') || 'Scroll up to load older messages')}
          </div>
        )}
        {hasMoreMessages && (
          <div className="show-mobile" style={{ justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => {
                void onLoadOlderMessages();
              }}
              disabled={loadingMoreMessages}
              className="glass-interactive"
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: '700',
                cursor: loadingMoreMessages ? 'not-allowed' : 'pointer',
                opacity: loadingMoreMessages ? 0.6 : 1,
              }}
            >
              {loadingMoreMessages ? (t('common.messages.loading') || 'Loading...') : (t('inbox.loadOlder') || 'Load older')}
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '14px' }}>{t('inbox.waitingNewMessage') || 'กำลังรอข้อความใหม่...'}</p>
          </div>
        )}
        {messages.filter((message) => message.message_type !== 'unsent').map((msg, index) => {
            const isOwn = msg.staff_id === agent?.id;
            const isAdmin = agent?.role === 'Administrator';
            const canDelete = Boolean((isOwn || isAdmin) && msg.sender_type === 'agent' && onDeleteMessage);

            return (
              <div key={msg.id} className="animate-content-slide" style={{ 
                alignSelf: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start', 
                maxWidth: '80%',
                animationDelay: `${Math.min(0.3, (index % 10) * 0.05)}s` 
              }}>
                 <div style={{ 
                    padding: '12px 18px', 
                    borderRadius: msg.sender_type === 'agent' ? '20px 20px 4px 20px' : '20px 20px 20px 4px', 
                    background: msg.sender_type === 'agent' 
                      ? 'linear-gradient(135deg, var(--secondary) 0%, oklch(60% 0.15 280) 100%)' 
                      : (msg.sender_type === 'system' ? 'var(--bg-input)' : 'var(--bg-card)'),
                    border: '1px solid ' + (msg.sender_type === 'agent' ? 'rgba(255, 255, 255, 0.1)' : 'var(--border)'),
                    fontSize: '14px',
                    lineHeight: '1.6',
                    boxShadow: msg.sender_type === 'agent' ? '0 8px 25px -5px rgba(115, 103, 240, 0.3)' : 'none',
                    color: msg.sender_type === 'system' 
                      ? 'var(--primary)' 
                      : (msg.sender_type === 'agent' ? 'white' : 'var(--text-main)'),
                    position: 'relative',
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                 }}>
                   {(msg.media_path || msg.content) && (msg.message_type === 'image' || (String(msg.media_path || msg.content).startsWith('http') && String(msg.media_path || msg.content).match(/\.(jpeg|jpg|gif|png|webp|JPG|PNG)$/i))) ? (
                      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '10px' }}>
                         <img 
                            src={msg.media_path || msg.content || ''} 
                            loading="lazy"
                            style={{ maxWidth: '100%', borderRadius: '10px', display: 'block', cursor: 'pointer' }} 
                            onClick={() => onEditImage(msg.media_path || msg.content || '')}
                            alt="Chat attachment" 
                            title={t('inbox.imageEditHint') || 'คลิกเพื่อทำการแก้ไขภาพ (Edit/Draw)'}
                         />
                      </div>
                   ) : msg.message_type === 'file' || ((msg.media_path || msg.content)?.startsWith('http') && msg.message_type !== 'text') ? (
                      <a href={msg.media_path || msg.content || ''} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>
                         <Clock size={16} /> {t('inbox.viewAttachment') || 'ดูไฟล์แนบ'}
                      </a>
                   ) : (
                      msg.content
                   )}

                   {canDelete && (
                     <button 
                       onClick={() => onDeleteMessage && onDeleteMessage(msg.id)}
                       className="glass-interactive flex-center"
                       style={{
                         position: 'absolute',
                         right: msg.sender_type === 'agent' ? 'auto' : '-10px',
                         left: msg.sender_type === 'agent' ? '-10px' : 'auto',
                         top: '-10px',
                         width: '24px',
                         height: '24px',
                         borderRadius: '50%',
                         background: 'rgba(255, 68, 68, 0.9)',
                         color: 'white',
                         border: 'none',
                         cursor: 'pointer',
                         boxShadow: '0 2px 8px rgba(255, 68, 68, 0.3)',
                         zIndex: 10
                       }}
                       title="Unsend"
                     >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                     </button>
                   )}
                </div>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', textAlign: msg.sender_type === 'agent' ? 'right' : 'left', opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start', gap: '4px' }}>
                   {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
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
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-topbar)', position: 'relative' }}>
        {showCanned && (
          <div className="glass animate-fade-in" style={{ position: 'absolute', bottom: '100%', left: '24px', right: '24px', marginBottom: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 -10px 25px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
              <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>{t('inbox.quickReplies') || 'ข้อความสำเร็จรูป (QUICK REPLIES)'}</p>
              <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); onAddCanned(); }} 
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800' }}>
                 <Plus size={12} /> {t('common.add')}
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
                 <p style={{ fontSize: '13px', color: '#ff9f43', fontWeight: '800' }}>{t('inbox.unassignedTicketNotice') || 'ใบงานยังไม่มีผู้ดูแล'}</p>
              </div>
              <button 
                onClick={onClaim}
                style={{ padding: '6px 16px', borderRadius: '8px', background: 'var(--primary)', color: 'black', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
              >
                 {t('inbox.claimTicket')}
              </button>
            </div>
         )}
         <form onSubmit={onSendMessage}>
          <div className="glass" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-input)', borderRadius: '14px', border: '1px solid var(--border)' }}>
             <button type="button" onClick={() => setShowCanned(!showCanned)} title={t('inbox.quickReplies') || 'ข้อความสำเร็จรูป'} aria-label="Quick replies" className="glass-interactive flex-center" style={{ width: '36px', height: '36px', background: 'none', border: 'none', color: showCanned ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}><MessageSquare size={19} aria-hidden="true" /></button>
             <button type="button" onClick={onAttachClick} title={t('inbox.attachHint') || 'แนบไฟล์หรือวางรูปภาพ (Ctrl+V)'} aria-label="Attach file or paste image" className="glass-interactive flex-center" style={{ width: '36px', height: '36px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Paperclip size={20} aria-hidden="true" /></button>

           <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                 isResolved
                   ? (t('inbox.readOnlyPlaceholder') || 'ใบงานถูกปิดแล้ว (Read Only)')
                   : isViewOnly
                     ? (t('inbox.viewOnlyPlaceholder') || 'คุณมีสิทธิ์อ่านเท่านั้น (View Only)')
                     : isRestricted
                       ? (t('inbox.claimBeforeChatPlaceholder') || 'กรุณากดรับงานก่อนเริ่มการสนทนา')
                       : (t('inbox.typeMessagePlaceholder') || 'พิมพ์ข้อความ หรือวางรูปภาพ Ctrl+V...')
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


