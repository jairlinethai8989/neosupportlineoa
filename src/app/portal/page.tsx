'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLiff } from '@/hooks/useLiff';
import { getPortalHomeAction, submitPortalCsatAction } from '@/app/actions/portalActions';
import { 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  ShieldAlert,
  Settings,
  ArrowRight,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search
} from 'lucide-react';
import Link from 'next/link';
import Skeleton from '@/components/ui/Skeleton';

const ProfileRegistrationModal = React.lazy(() => import('@/components/portal/ProfileRegistrationModal'));

const ITEMS_PER_PAGE = 5;
// 1. Memoized Survey Modal to prevent full page re-renders during star hover/typing
interface PortalSurveyModalProps {
  showSurvey: boolean;
  pendingSurveyTicket: any;
  surveyValue: number;
  surveyHover: number;
  surveyComment: string;
  submittingSurvey: boolean;
  setSurveyValue: (val: number) => void;
  setSurveyHover: (val: number) => void;
  setSurveyComment: (val: string) => void;
  setShowSurvey: (val: boolean) => void;
  onSubmit: () => void;
}

const PortalSurveyModal = React.memo(function PortalSurveyModal({
  showSurvey,
  pendingSurveyTicket,
  surveyValue,
  surveyHover,
  surveyComment,
  submittingSurvey,
  setSurveyValue,
  setSurveyHover,
  setSurveyComment,
  setShowSurvey,
  onSubmit,
}: PortalSurveyModalProps) {
  if (!showSurvey || !pendingSurveyTicket) return null;

  return (
    <div className="portal-survey-overlay">
      <div className="portal-survey-modal">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            padding: '12px',
            background: '#f0f9ff',
            borderRadius: '50%',
            marginBottom: '16px',
            color: 'var(--portal-primary)',
          }}>
            <Clock size={24} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', marginBottom: '8px' }}>
            ประเมินความพึงพอใจ
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            งานหมายเลข #{pendingSurveyTicket.ticket_no} ได้รับการแก้ไขแล้ว ช่วยให้คะแนนเราหน่อยนะครับ
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setSurveyValue(star)}
              onMouseEnter={() => setSurveyHover(star)}
              onMouseLeave={() => setSurveyHover(0)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none', transition: 'transform 0.2s', padding: '4px' }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill={(surveyHover || surveyValue) >= star ? '#f59e0b' : 'none'}
                stroke={(surveyHover || surveyValue) >= star ? '#f59e0b' : '#cbd5e1'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', height: '20px', fontSize: '12px', color: '#f59e0b', fontWeight: '700', marginBottom: '24px' }}>
          {surveyValue === 5 ? 'ยอดเยี่ยมที่สุด' : surveyValue === 4 ? 'ดีมาก' : surveyValue === 3 ? 'ดี' : surveyValue === 2 ? 'พอใช้' : surveyValue === 1 ? 'ควรปรับปรุง' : ''}
        </div>

        <textarea
          placeholder="ข้อเสนอแนะเพิ่มเติม (ถ้ามี)..."
          value={surveyComment}
          onChange={(event) => setSurveyComment(event.target.value)}
          className="portal-survey-comment"
        />

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setShowSurvey(false)}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              background: 'white',
              color: '#64748b',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            ข้ามก่อน
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submittingSurvey || surveyValue === 0}
            style={{
              flex: 2,
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--portal-primary)',
              color: 'white',
              fontWeight: '800',
              cursor: 'pointer',
              opacity: submittingSurvey || surveyValue === 0 ? 0.5 : 1,
            }}
          >
            {submittingSurvey ? 'กำลังส่ง...' : 'ส่งผลประเมิน'}
          </button>
        </div>
      </div>
    </div>
  );
});

// 2. Memoized Ticket Card to prevent excessive rendering when main page states change
interface PortalTicketCardProps {
  ticket: any;
  isPast?: boolean;
}

const PortalTicketCard = React.memo(function PortalTicketCard({ ticket, isPast = false }: PortalTicketCardProps) {
  if (isPast) {
    return (
      <Link href={`/portal/tickets/${ticket.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="portal-glass" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid rgba(0,0,0,0.02)' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>#{ticket.ticket_no}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{
                background: '#dcfce7',
                color: '#166534',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: '800'
              }}>สำเร็จ</span>
              <p style={{ fontSize: '11px', color: 'var(--portal-text-muted)' }}>{new Date(ticket.resolved_at || ticket.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} color="#22c55e" />
            <ArrowRight size={14} color="#cbd5e1" />
          </div>
        </div>
      </Link>
    );
  }

  const statusLower = String(ticket.status || '').toLowerCase();
  const badgeBg = statusLower === 'in progress' ? '#dbeafe' : statusLower === 'pending' ? '#fef3c7' : statusLower === 'escalated' ? '#fee2e2' : '#f1f5f9';
  const badgeColor = statusLower === 'in progress' ? '#1e40af' : statusLower === 'pending' ? '#92400e' : statusLower === 'escalated' ? '#991b1b' : '#475569';

  return (
    <Link href={`/portal/tickets/${ticket.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="portal-glass" style={{ padding: '16px', background: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: '700', fontSize: '14px', marginBottom: '2px', color: '#0f172a' }}>#{ticket.ticket_no}</p>
            <p className="truncate" style={{ fontSize: '12px', color: '#64748b' }}>{ticket.subject || 'แจ้งปัญหาทั่วไป'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: badgeBg,
              color: badgeColor,
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: '800',
              borderRadius: '8px',
              border: '1px solid rgba(0,0,0,0.05)'
            }}>{ticket.status}</span>
            <ArrowRight size={14} color="#94a3b8" />
          </div>
        </div>
      </div>
    </Link>
  );
});

export default function PortalPage() {
  const { profile, idToken, isReady, error: liffError, setMockLogin } = useLiff();
  const [activeTickets, setActiveTickets] = useState<any[]>([]);
  const [pastTickets, setPastTickets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [totalHistory, setTotalHistory] = useState(0);
  const [showSurvey, setShowSurvey] = useState(false);
  const [pendingSurveyTicket, setPendingSurveyTicket] = useState<any | null>(null);
  const [surveyValue, setSurveyValue] = useState(0);
  const [surveyHover, setSurveyHover] = useState(0);
  const [surveyComment, setSurveyComment] = useState('');
  const [submittingSurvey, setSubmittingSurvey] = useState(false);

  // FIX #3: Use ref for historyPage so fetchTickets doesn't recreate on page change
  const historyPageRef = useRef(historyPage);
  useEffect(() => { historyPageRef.current = historyPage; }, [historyPage]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const debouncedSearchQueryRef = useRef(debouncedSearchQuery);
  useEffect(() => { debouncedSearchQueryRef.current = debouncedSearchQuery; }, [debouncedSearchQuery]);

  // FIX #1: Cache customerId in ref → avoid re-querying customers table on every fetch
  const customerIdRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  // FIX #1: fetchTickets only re-queries customers on first load (cached in ref)
  // FIX #3: reads historyPageRef.current and debouncedSearchQueryRef.current instead of states to keep callback stable
  const fetchTickets = useCallback(async (silent = false) => {
    if (!idToken) return;
    if (inFlightRef.current && silent) return;
    inFlightRef.current = true;

    if (!silent) setFetching(true);

    try {
      const page = historyPageRef.current;
      const query = debouncedSearchQueryRef.current;
      const directSurveyTicketId = new URLSearchParams(window.location.search).get('survey_ticket_id');
      const result = await getPortalHomeAction(idToken, { historyPage: page, search: query, directSurveyTicketId });
      setCustomerData(result.customer);
      customerIdRef.current = result.customer?.id || null;
      setNeedsRegistration(!result.customer?.organization_id);
      setActiveTickets(result.activeTickets);
      setPastTickets(result.pastTickets);
      setTotalHistory(result.totalHistory);
      setPendingSurveyTicket(result.pendingSurvey);
      setShowSurvey(Boolean(result.pendingSurvey));
    } catch (err) {
      console.error('Portal Fetch Error:', err);
    } finally {
      inFlightRef.current = false;
      setFetching(false);
    }
  }, [idToken]);
  // NOTE: historyPage/debouncedSearchQuery intentionally excluded — read via refs to keep callback stable

  // Trigger re-fetch when historyPage or debouncedSearchQuery changes (without recreating fetchTickets)
  useEffect(() => {
    if (idToken && customerIdRef.current) {
      void fetchTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPage, debouncedSearchQuery]);

  // Initial load + focus/popstate refresh (debounced)
  useEffect(() => {
    if (idToken) {
      void fetchTickets();
    }

    const scheduleRefresh = () => {
      if (!idToken) return;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        void fetchTickets(true);
      }, 250);
    };

    window.addEventListener('focus', scheduleRefresh);
    window.addEventListener('popstate', scheduleRefresh);

    return () => {
      window.removeEventListener('focus', scheduleRefresh);
      window.removeEventListener('popstate', scheduleRefresh);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [fetchTickets, idToken]);

  // Fallback polling: 60s to avoid massive DB load
  useEffect(() => {
    if (!customerData?.id) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const start = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (stopped) return;
        void fetchTickets(true);
      }, 60000);
    };

    const stop = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerData?.id]);

  const handleSubmitSurvey = useCallback(async () => {
    if (!pendingSurveyTicket?.id || surveyValue === 0) return;
    setSubmittingSurvey(true);
    try {
      if (!idToken) throw new Error('LINE identity token not loaded');
      await submitPortalCsatAction(pendingSurveyTicket.id, idToken, surveyValue, surveyComment);

      setShowSurvey(false);
      setPendingSurveyTicket(null);
      setSurveyValue(0);
      setSurveyHover(0);
      setSurveyComment('');
      await fetchTickets(true);
    } catch (err: any) {
      alert('ไม่สามารถบันทึกการประเมินได้: ' + err.message);
    } finally {
      setSubmittingSurvey(false);
    }
  }, [pendingSurveyTicket, surveyValue, surveyComment, fetchTickets, idToken]);


  if (!isReady || (profile && fetching && !needsRegistration)) {
    return (
      <div className="animate-page-in">
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Skeleton width={120} height={12} marginBottom={12} />
            <Skeleton width={250} height={32} />
          </div>
          <Skeleton width={44} height={44} borderRadius={12} />
        </div>

        <div style={{ marginBottom: '40px' }}>
          <div className="portal-glass" style={{ padding: '24px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
             <Skeleton width={44} height={44} borderRadius={14} />
             <Skeleton width={200} height={24} />
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
             <Skeleton width={180} height={16} />
             <Skeleton width={80} height={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
             {[1, 2, 3].map((i) => (
                <div key={i} className="portal-glass" style={{ padding: '20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ flex: 1 }}>
                      <Skeleton width={120} height={20} marginBottom={8} />
                      <Skeleton width="60%" height={16} />
                   </div>
                   <Skeleton width={80} height={24} borderRadius={30} />
                </div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  if (liffError || !profile) {
    return (
      <div className="flex-center portal-glass" style={{ height: '70vh', margin: '20px', padding: '32px', textAlign: 'center', flexDirection: 'column', gap: '20px', border: '1px solid #fee2e2', background: 'white' }}>
        <ShieldAlert size={48} color="#ef4444" />
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>ไม่สามารถเข้าถึงได้</h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>กรุณาเข้าใช้งานผ่านแอปพลิเคชัน LINE เพื่อการบริการที่สมบูรณ์</p>
        <button 
           type="button"
           onClick={() => setMockLogin()}
           style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: '700', marginTop: '16px', cursor: 'pointer' }}
        >
           จำลองสถานะการทำงาน (Mock Login)
        </button>
      </div>
    );
  }

  return (
    <>
    <div>
      <PortalSurveyModal
        showSurvey={showSurvey}
        pendingSurveyTicket={pendingSurveyTicket}
        surveyValue={surveyValue}
        surveyHover={surveyHover}
        surveyComment={surveyComment}
        submittingSurvey={submittingSurvey}
        setSurveyValue={setSurveyValue}
        setSurveyHover={setSurveyHover}
        setSurveyComment={setSurveyComment}
        setShowSurvey={(show) => {
          setShowSurvey(show);
          if (!show && typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (url.searchParams.has('survey_ticket_id')) {
              url.searchParams.delete('survey_ticket_id');
              window.history.replaceState({}, '', url.toString());
            }
          }
        }}
        onSubmit={handleSubmitSurvey}
      />

      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div>
            <p style={{ color: 'var(--portal-primary)', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '10px', marginBottom: '4px' }}>Support Portal</p>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>สวัสดี, {profile?.displayName?.split(' ')[0] || 'คุณลูกค้า'}</h2>
         </div>
          <div style={{ display: 'flex', gap: '10px' }}>
             <button type="button" onClick={() => fetchTickets()} style={{ padding: '8px', border: '1px solid var(--portal-border)', borderRadius: '8px', background: 'white', color: fetching ? 'var(--portal-primary)' : '#64748b', cursor: 'pointer' }} aria-label="Refresh">
                <RefreshCw size={20} className={fetching ? 'animate-spin' : ''} />
             </button>
             <button type="button" onClick={() => setIsEditModalOpen(true)} style={{ padding: '8px', border: '1px solid var(--portal-border)', borderRadius: '8px', background: 'white', color: '#64748b', cursor: 'pointer' }} aria-label="Settings">
                <Settings size={20} />
             </button>
          </div>
      </div>

      <section style={{ marginBottom: '32px' }}>
         <Link href="/portal/create" style={{ textDecoration: 'none' }}>
            <div className="portal-btn-primary" style={{ 
               padding: '16px', 
               borderRadius: '12px',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '12px'
            }}>
               <MessageSquare size={20} />
               <p style={{ fontSize: '16px', fontWeight: '700' }}>แจ้งปัญหาการใช้งานใหม่</p>
            </div>
         </Link>
      </section>

      <section style={{ marginBottom: '32px' }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
               ใบงานที่กำลังดำเนินการ
            </h3>
         </div>

         {activeTickets.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: '12px' }}>
               <p style={{ fontSize: '13px' }}>ขณะนี้คุณไม่มีใบงานที่ค้างอยู่</p>
            </div>
         ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {activeTickets.map(ticket => (
                  <PortalTicketCard key={ticket.id} ticket={ticket} />
                ))}
            </div>
         )}
      </section>

      {/* History */}
      <section style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderTop: '1px solid var(--portal-border)', paddingTop: '24px' }}>
           <Clock size={16} color="var(--portal-text-muted)" />
           <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>ประวัติการแจ้งงาน</h3>
        </div>

        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search 
            size={18} 
            color="var(--portal-text-muted)" 
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} 
          />
          <input
            type="text"
            placeholder="ค้นหาตามเลขใบงาน หรือ หัวข้อเรื่อง..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setHistoryPage(1);
            }}
            style={{
              width: '100%',
              padding: '12px 16px 12px 42px',
              borderRadius: '12px',
              border: '1px solid var(--portal-border)',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s',
              background: '#f8fafc',
            }}
          />
        </div>
        
        {pastTickets.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '12px' }}>
              {searchQuery.trim() ? 'ไม่พบประวัติการแจ้งงานที่ตรงกับการค้นหา' : 'ยังไม่มีประวัติการแจ้งงาน'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               {pastTickets.map(ticket => (
                  <PortalTicketCard key={ticket.id} ticket={ticket} isPast />
               ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
               <button 
                  type="button"
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage(1)}
                  style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--portal-border)', background: 'white', opacity: historyPage === 1 ? 0.3 : 1, cursor: 'pointer' }}
               >
                  <ChevronsLeft size={16} />
               </button>
               <button 
                  type="button"
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage(prev => prev - 1)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--portal-border)', background: 'white', color: '#1e293b', fontWeight: '700', fontSize: '13px', opacity: historyPage === 1 ? 0.3 : 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
               >
                  <ChevronLeft size={16} /> ก่อนหน้า
               </button>
               
               <span style={{ fontSize: '13px', fontWeight: '800', color: '#64748b', margin: '0 8px' }}>
                  หน้า {historyPage} / {Math.ceil(totalHistory / ITEMS_PER_PAGE) || 1}
               </span>

               <button 
                  type="button"
                  disabled={historyPage * ITEMS_PER_PAGE >= totalHistory}
                  onClick={() => setHistoryPage(prev => prev + 1)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--portal-border)', background: 'white', color: '#1e293b', fontWeight: '700', fontSize: '13px', opacity: historyPage * ITEMS_PER_PAGE >= totalHistory ? 0.3 : 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
               >
                  ถัดไป <ChevronRight size={16} />
               </button>
               <button 
                  type="button"
                  disabled={historyPage * ITEMS_PER_PAGE >= totalHistory}
                  onClick={() => setHistoryPage(Math.ceil(totalHistory / ITEMS_PER_PAGE))}
                  style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--portal-border)', background: 'white', opacity: historyPage * ITEMS_PER_PAGE >= totalHistory ? 0.3 : 1, cursor: 'pointer' }}
               >
                  <ChevronsRight size={16} />
               </button>
            </div>
          </>
        )}
      </section>
    </div>

    {/* MODALS - Moved outside container to avoid transform-fixed ghosting */}
    <React.Suspense fallback={null}>
      <ProfileRegistrationModal 
          isOpen={needsRegistration || isEditModalOpen}
          profile={profile}
          idToken={idToken}
          existingCustomer={customerData}
          onComplete={() => {
              setIsEditModalOpen(false);
              customerIdRef.current = null; // reset cache so customer data re-fetched
              fetchTickets();
          }}
          onClose={() => setIsEditModalOpen(false)}
      />
    </React.Suspense>
    </>
  );
}
