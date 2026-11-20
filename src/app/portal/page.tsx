'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useLiff } from '@/hooks/useLiff';
import { supabase } from '@/lib/supabase';
import { submitSurveyAction } from '@/app/actions/portalActions';
import {
  MessageSquare,
  Check,
  Clock,
  ShieldAlert,
  Settings,
  ChevronRight,
  RefreshCw,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import styles from './portal.module.css';

const ProfileRegistrationModal = React.lazy(() => import('@/components/portal/ProfileRegistrationModal'));

const ITEMS_PER_PAGE = 5;

const RATING_LABELS: Record<number, string> = {
  1: 'ควรปรับปรุง',
  2: 'พอใช้',
  3: 'ดี',
  4: 'ดีมาก',
  5: 'ยอดเยี่ยมที่สุด',
};

const PROGRESS_STEPS = ['รับเรื่องแล้ว', 'กำลังแก้ไข', 'เสร็จสิ้น'] as const;

function isSurveyEligibleStatus(status: unknown) {
  const s = String(status || '').toLowerCase();
  return s === 'resolved' || s === 'closed';
}

/** Maps a ticket status to the 1-based current step of the 3-step stepper. */
function getProgressStep(status: unknown): number {
  const s = String(status || '').toLowerCase();
  if (s === 'resolved' || s === 'closed') return 3;
  if (s === 'open' || s === 'new' || s === '') return 1;
  return 2;
}

function getStatusBadge(status: unknown): { className: string; label: string } {
  const s = String(status || '').toLowerCase();
  if (s === 'in progress') return { className: styles.badgeBrand, label: String(status) };
  if (s === 'pending') return { className: styles.badgeWarning, label: String(status) };
  if (s === 'escalated') return { className: styles.badgeDanger, label: String(status) };
  if (s === 'fix completed') return { className: styles.badgeInfo, label: 'รอตรวจสอบ (Fix Completed)' };
  return { className: styles.badgeNeutral, label: String(status || 'Open') };
}

// 3-step visual progress stepper (รับเรื่องแล้ว -> กำลังแก้ไข -> เสร็จสิ้น)
function ProgressStepper({ status }: { status: unknown }) {
  const current = getProgressStep(status);
  return (
    <ol className={styles.stepper} aria-label={`ความคืบหน้า: ${PROGRESS_STEPS[current - 1]}`}>
      {PROGRESS_STEPS.map((label, index) => {
        const stepNo = index + 1;
        const done = stepNo < current || current === 3;
        const isCurrent = stepNo === current && current !== 3;
        return (
          <li
            key={label}
            className={clsx(styles.step, done && styles.stepDone, isCurrent && styles.stepCurrent)}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className={styles.stepDot} aria-hidden="true">
              {done && <Check size={14} strokeWidth={3} />}
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const isVisible = showSurvey && Boolean(pendingSurveyTicket);

  useEffect(() => {
    if (!isVisible) return;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSurvey(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isVisible, setShowSurvey]);

  if (!isVisible) return null;

  const activeValue = surveyHover || surveyValue;

  return (
    <div className={styles.overlay}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-survey-title"
        tabIndex={-1}
      >
        <div className={styles.dialogHead}>
          <span className={styles.dialogIcon} aria-hidden="true">
            <Clock size={24} />
          </span>
          <h3 id="portal-survey-title" className={styles.dialogTitle}>
            ประเมินความพึงพอใจ
          </h3>
          <p className={styles.dialogText}>
            งานหมายเลข <span className={styles.tabular}>#{pendingSurveyTicket.ticket_no}</span> ได้รับการแก้ไขแล้ว
            ช่วยให้คะแนนเราหน่อยนะครับ
          </p>
        </div>

        <div role="radiogroup" aria-label="ให้คะแนนความพึงพอใจ 1 ถึง 5 ดาว" className={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={surveyValue === star}
              aria-label={`${star} ดาว - ${RATING_LABELS[star]}`}
              className={clsx(styles.star, activeValue >= star && styles.starOn)}
              onClick={() => setSurveyValue(star)}
              onMouseEnter={() => setSurveyHover(star)}
              onMouseLeave={() => setSurveyHover(0)}
            >
              <Star size={36} strokeWidth={2} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className={styles.ratingLabel} aria-live="polite">
          {RATING_LABELS[surveyValue] || ''}
        </div>

        <div className={styles.field}>
          <label htmlFor="portal-survey-comment" className={styles.label}>
            ข้อเสนอแนะเพิ่มเติม (ถ้ามี)
          </label>
          <textarea
            id="portal-survey-comment"
            placeholder="บอกเราได้ครับว่าชอบส่วนไหน หรืออยากให้ปรับปรุงอะไร"
            value={surveyComment}
            onChange={(event) => setSurveyComment(event.target.value)}
            className={styles.textarea}
          />
        </div>

        <div className={styles.dialogActions}>
          <button type="button" onClick={() => setShowSurvey(false)} className={clsx(styles.btn, styles.btnSecondary)}>
            ข้ามก่อน
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submittingSurvey || surveyValue === 0}
            className={clsx(styles.btn, styles.btnPrimary)}
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
  projectQuery?: string;
}

const PortalTicketCard = React.memo(function PortalTicketCard({
  ticket,
  isPast = false,
  projectQuery = '',
}: PortalTicketCardProps) {
  const href = `/portal/tickets/${ticket.id}${projectQuery}`;

  if (isPast) {
    const isCanceled = String(ticket.status || '').toLowerCase() === 'canceled';
    return (
      <Link href={href} className={clsx(styles.ticketLink, styles.ticketLinkPast)}>
        <div className={styles.ticketTop}>
          <div className={styles.ticketMain}>
            <p className={styles.ticketNo}>#{ticket.ticket_no}</p>
            <div className={styles.ticketMeta}>
              <span className={clsx(styles.badge, isCanceled ? styles.badgeNeutral : styles.badgeSuccess)}>
                {isCanceled ? 'ยกเลิก' : 'สำเร็จ'}
              </span>
              <span>
                {new Date(ticket.resolved_at || ticket.created_at).toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: '2-digit',
                })}
              </span>
            </div>
          </div>
          <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
        </div>
      </Link>
    );
  }

  const badge = getStatusBadge(ticket.status);

  return (
    <Link href={href} className={styles.ticketLink}>
      <div className={styles.ticketTop}>
        <div className={styles.ticketMain}>
          <p className={styles.ticketNo}>#{ticket.ticket_no}</p>
          <p className={styles.ticketSubject}>{ticket.subject || 'แจ้งปัญหาทั่วไป'}</p>
        </div>
        <span className={clsx(styles.badge, badge.className)}>{badge.label}</span>
      </div>
      <ProgressStepper status={ticket.status} />
    </Link>
  );
});

export default function PortalPage() {
  const { profile, isReady, error: liffError, projectConfig, projectOrganizations, setMockLogin } = useLiff();
  const projectQuery =
    projectConfig && !projectConfig.is_default && projectConfig.slug
      ? `?project=${encodeURIComponent(projectConfig.slug)}`
      : '';
  const realProjectId =
    projectConfig?.id && projectConfig.id !== 'default-env-fallback' ? projectConfig.id : null;
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

  // FIX #1: Cache customerId & customer record in refs -> avoid re-querying customers table on every fetch
  const customerIdRef = useRef<string | null>(null);
  const customerDataRef = useRef<any>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  const refreshPendingSurvey = useCallback(
    async (customerId: string, knownTickets?: any[]) => {
      const resolvedTickets =
        (knownTickets || [])
          .filter((ticket) => isSurveyEligibleStatus(ticket.status))
          .sort(
            (left, right) =>
              new Date(right.resolved_at || right.created_at).getTime() -
              new Date(left.resolved_at || left.created_at).getTime()
          );

      const candidates =
        resolvedTickets.length > 0
          ? resolvedTickets
          : (
              await supabase
                .from('tickets')
                .select('id, ticket_no, subject, status, created_at, resolved_at')
                .eq('customer_id', customerId)
                .in('status', ['Resolved', 'Closed'])
                .order('resolved_at', { ascending: false, nullsFirst: false })
                .limit(10)
            ).data || [];

      if (candidates.length === 0) {
        setPendingSurveyTicket(null);
        setShowSurvey(false);
        return;
      }

      const candidateIds = candidates.map((ticket) => ticket.id);
      const { data: surveyRows } = await supabase
        .from('csat_surveys')
        .select('ticket_id, score, rating, responded_at')
        .in('ticket_id', candidateIds);

      const surveyByTicketId = new Map(
        (surveyRows || []).map((row) => [row.ticket_id, row])
      );

      const pendingTicket =
        candidates.find((ticket) => {
          const survey = surveyByTicketId.get(ticket.id);
          const hasScore = Boolean(survey?.score || survey?.rating);
          return !survey || (!survey.responded_at && !hasScore);
        }) || null;

      setPendingSurveyTicket(pendingTicket);
      setShowSurvey(Boolean(pendingTicket));
      if (!pendingTicket) {
        setSurveyValue(0);
        setSurveyHover(0);
        setSurveyComment('');
      }
    },
    []
  );

  // FIX #1: fetchTickets only re-queries customers on first load (cached in ref)
  // FIX #3: reads historyPageRef.current and debouncedSearchQueryRef.current instead of states to keep callback stable
  const fetchTickets = useCallback(async (silent = false) => {
    if (!profile?.userId) return;
    if (inFlightRef.current && silent) return;
    inFlightRef.current = true;

    if (!silent) setFetching(true);

    try {
      // Use cached customerId when available and organization_id is already registered
      let customerId = customerIdRef.current;
      let customer: any = customerDataRef.current;

      if (!customerId || !customer?.organization_id) {
        let custQuery = supabase
          .from('customers')
          .select('*, organizations(name, abbreviation)')
          .eq('line_user_id', profile.userId);
        if (realProjectId) {
          custQuery = custQuery.eq('project_id', realProjectId);
        }
        const { data } = await custQuery.limit(1).maybeSingle();
        customer = data;
        if (customer?.id) {
          customerIdRef.current = customer.id;
          customerId = customer.id;
          customerDataRef.current = customer;
          setCustomerData(customer);
        }
      }

      if (!customerId || !customer?.organization_id) {
        setNeedsRegistration(true);
        return;
      }

      setNeedsRegistration(false);

      const page = historyPageRef.current;
      const query = debouncedSearchQueryRef.current;
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Build paginated query for past tickets
      let pastQuery = supabase
        .from('tickets')
        .select('id, ticket_no, subject, status, created_at, resolved_at', { count: 'exact' })
        .eq('customer_id', customerId)
        .in('status', ['Resolved', 'Closed', 'Canceled', 'resolved', 'closed', 'canceled']);

      if (query.trim()) {
        const cleanQuery = query.trim();
        pastQuery = pastQuery.or(`ticket_no.ilike.%${cleanQuery}%,subject.ilike.%${cleanQuery}%`);
      }

      const [activeRes, pastRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('id, ticket_no, subject, status, created_at, resolved_at')
          .eq('customer_id', customerId)
          .not('status', 'in', '("Resolved","Closed","Canceled","resolved","closed","canceled")')
          .order('created_at', { ascending: false }),
        pastQuery
          .order('created_at', { ascending: false })
          .range(from, to)
      ]);

      if (activeRes.data) {
        setActiveTickets(activeRes.data);
      }
      if (pastRes.data) {
        setPastTickets(pastRes.data);
        void refreshPendingSurvey(customerId, [...(activeRes.data || []), ...pastRes.data]);
      }
      if (pastRes.count !== null) setTotalHistory(pastRes.count);
    } catch (err) {
      console.error('Portal Fetch Error:', err);
    } finally {
      inFlightRef.current = false;
      setFetching(false);
    }
  }, [profile?.userId, realProjectId, refreshPendingSurvey]);
  // NOTE: historyPage/debouncedSearchQuery intentionally excluded — read via refs to keep callback stable

  // Trigger re-fetch when historyPage or debouncedSearchQuery changes (without recreating fetchTickets)
  useEffect(() => {
    if (profile?.userId && customerIdRef.current) {
      void fetchTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPage, debouncedSearchQuery]);

  // Initial load + focus/popstate refresh (debounced)
  useEffect(() => {
    if (profile?.userId) {
      void fetchTickets();
    }

    const scheduleRefresh = () => {
      if (!profile?.userId) return;
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
  }, [fetchTickets, profile?.userId]);

  // Trigger CSAT survey directly if redirected with survey_ticket_id query parameter
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const surveyTicketId = params.get('survey_ticket_id');
    if (!surveyTicketId) return;

    const checkDirectSurvey = async () => {
      try {
        const { data: ticketData } = await supabase
          .from('tickets')
          .select('id, ticket_no, subject, status, created_at, resolved_at')
          .eq('id', surveyTicketId)
          .maybeSingle();

        if (ticketData && isSurveyEligibleStatus(ticketData.status)) {
          const { data: surveyRow } = await supabase
            .from('csat_surveys')
            .select('score, rating, responded_at')
            .eq('ticket_id', surveyTicketId)
            .maybeSingle();

          const hasScore = Boolean(surveyRow?.score || surveyRow?.rating);
          if (!surveyRow || (!surveyRow.responded_at && !hasScore)) {
            setPendingSurveyTicket(ticketData);
            setShowSurvey(true);
          }
        }
      } catch (err) {
        console.error('Failed to check direct survey ticket:', err);
      }
    };

    void checkDirectSurvey();
  }, []);

  // FIX #3: Realtime subscription depends only on customerId (stable), NOT historyPage
  useEffect(() => {
    if (!customerData?.id) return;
    const customerId = customerData.id;

    const channel = supabase
      .channel(`portal_tickets_${customerId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `customer_id=eq.${customerId}`
      }, () => {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
        }
        refreshTimerRef.current = setTimeout(() => {
          void fetchTickets(true);
          setTimeout(() => {
            void refreshPendingSurvey(customerId);
          }, 500);
        }, 350);
      })
      .subscribe((status) => {
        console.log(`[Portal Realtime] Subscription status for customer ${customerId}:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerData?.id]);
  // NOTE: fetchTickets/refreshPendingSurvey intentionally excluded to prevent re-subscribing

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
      const result = await submitSurveyAction(pendingSurveyTicket.id, surveyValue, surveyComment);
      if (!result.success && !result.alreadySubmitted) {
        throw new Error(result.error || 'ไม่สามารถบันทึกการประเมินได้');
      }

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
  }, [pendingSurveyTicket, surveyValue, surveyComment, fetchTickets]);


  const accentStyle = projectConfig?.primary_color
    ? ({ '--portal-accent': projectConfig.primary_color } as React.CSSProperties)
    : undefined;
  const projectName = projectConfig?.name || 'Support Portal';
  const customerOrgName = customerData?.organizations?.name || '';
  const totalHistoryPages = Math.ceil(totalHistory / ITEMS_PER_PAGE) || 1;

  if (!isReady || (profile && fetching && !needsRegistration)) {
    return (
      <div className={styles.root} style={accentStyle} role="status" aria-live="polite" aria-label="กำลังโหลดข้อมูล">
        <div className={styles.header}>
          <div className={styles.brand}>
            <span className={clsx(styles.skeleton)} style={{ width: 48, height: 48 }} />
            <div>
              <span className={styles.skeleton} style={{ width: 96, height: 12, marginBottom: 8 }} />
              <span className={styles.skeleton} style={{ width: 180, height: 22 }} />
            </div>
          </div>
        </div>
        <span className={styles.skeleton} style={{ width: '100%', height: 48, borderRadius: 10 }} />
        <div className={styles.list}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.card}>
              <span className={styles.skeleton} style={{ width: 120, height: 18, marginBottom: 8 }} />
              <span className={styles.skeleton} style={{ width: '60%', height: 14, marginBottom: 16 }} />
              <span className={styles.skeleton} style={{ width: '100%', height: 24 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (liffError || !profile) {
    return (
      <div className={clsx(styles.root, styles.fatal)} style={accentStyle} role="alert">
        <ShieldAlert size={48} className={styles.fatalIcon} aria-hidden="true" />
        <h2>ไม่สามารถเข้าถึงได้</h2>
        <p>กรุณาเข้าใช้งานผ่านแอปพลิเคชัน LINE เพื่อการบริการที่สมบูรณ์</p>
        <button type="button" onClick={() => setMockLogin()} className={clsx(styles.btn, styles.btnSecondary)}>
          จำลองสถานะการทำงาน (Mock Login)
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.root} style={accentStyle}>
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

        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.logo}>
              {projectConfig?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={projectConfig.logo_url} alt={`โลโก้ ${projectName}`} />
              ) : (
                <span aria-hidden="true">{projectName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className={styles.brandText}>
              <p className={styles.projectName}>{projectName}</p>
              <h2 className={styles.greeting}>สวัสดี, {profile?.displayName?.split(' ')[0] || 'คุณลูกค้า'}</h2>
              {customerOrgName && <p className={styles.orgLine}>{customerOrgName}</p>}
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={() => fetchTickets()}
              className={styles.iconBtn}
              aria-label="รีเฟรชข้อมูล"
            >
              <RefreshCw size={20} className={fetching ? styles.spin : undefined} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className={styles.iconBtn}
              aria-label="แก้ไขข้อมูลส่วนตัว"
            >
              <Settings size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <section aria-label="เปิดใบงานใหม่">
          <Link href={`/portal/create${projectQuery}`} className={clsx(styles.btn, styles.btnPrimary, styles.btnBlock)}>
            <MessageSquare size={20} aria-hidden="true" />
            แจ้งปัญหา / เปิดใบงานใหม่
          </Link>
        </section>

        <section className={styles.section} aria-labelledby="portal-active-heading">
          <div className={styles.sectionHead}>
            <h3 id="portal-active-heading" className={styles.sectionTitle}>
              ใบงานที่กำลังดำเนินการ
            </h3>
            {activeTickets.length > 0 && <span className={styles.countPill}>{activeTickets.length}</span>}
          </div>

          {activeTickets.length === 0 ? (
            <p className={styles.empty}>ขณะนี้คุณไม่มีใบงานที่ค้างอยู่</p>
          ) : (
            <ul className={styles.list}>
              {activeTickets.map((ticket) => (
                <li key={ticket.id}>
                  <PortalTicketCard ticket={ticket} projectQuery={projectQuery} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* History */}
        <section className={styles.section} aria-labelledby="portal-history-heading">
          <div className={styles.sectionHead}>
            <h3 id="portal-history-heading" className={styles.sectionTitle}>
              ประวัติการแจ้งงาน
            </h3>
          </div>

          <div className={styles.searchField}>
            <label htmlFor="portal-history-search" className={styles.srOnly}>
              ค้นหาประวัติตามเลขใบงานหรือหัวข้อเรื่อง
            </label>
            <Search size={18} className={styles.searchIcon} aria-hidden="true" />
            <input
              id="portal-history-search"
              type="search"
              placeholder="ค้นหาตามเลขใบงาน หรือ หัวข้อเรื่อง"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHistoryPage(1);
              }}
              className={styles.searchInput}
            />
          </div>

          {pastTickets.length === 0 ? (
            <p className={styles.empty}>
              {searchQuery.trim() ? 'ไม่พบประวัติการแจ้งงานที่ตรงกับการค้นหา' : 'ยังไม่มีประวัติการแจ้งงาน'}
            </p>
          ) : (
            <>
              <ul className={styles.list}>
                {pastTickets.map((ticket) => (
                  <li key={ticket.id}>
                    <PortalTicketCard ticket={ticket} isPast projectQuery={projectQuery} />
                  </li>
                ))}
              </ul>
              <nav className={styles.pagination} aria-label="เลื่อนหน้าประวัติการแจ้งงาน">
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage(1)}
                  aria-label="หน้าแรก"
                >
                  <ChevronsLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage((prev) => prev - 1)}
                  aria-label="หน้าก่อนหน้า"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                  ก่อนหน้า
                </button>

                <span className={styles.pageInfo} aria-live="polite">
                  หน้า {historyPage} / {totalHistoryPages}
                </span>

                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={historyPage * ITEMS_PER_PAGE >= totalHistory}
                  onClick={() => setHistoryPage((prev) => prev + 1)}
                  aria-label="หน้าถัดไป"
                >
                  ถัดไป
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={historyPage * ITEMS_PER_PAGE >= totalHistory}
                  onClick={() => setHistoryPage(Math.ceil(totalHistory / ITEMS_PER_PAGE))}
                  aria-label="หน้าสุดท้าย"
                >
                  <ChevronsRight size={18} aria-hidden="true" />
                </button>
              </nav>
            </>
          )}
        </section>
      </div>

      {/* MODALS - Moved outside container to avoid transform-fixed ghosting */}
      <React.Suspense fallback={null}>
        <ProfileRegistrationModal
          isOpen={needsRegistration || isEditModalOpen}
          profile={profile}
          projectConfig={projectConfig}
          projectOrganizations={projectOrganizations}
          existingCustomer={customerData}
          onComplete={() => {
            setNeedsRegistration(false);
            setIsEditModalOpen(false);
            customerIdRef.current = null; // reset cache so customer data re-fetched
            customerDataRef.current = null;
            fetchTickets();
          }}
          onClose={() => setIsEditModalOpen(false)}
        />
      </React.Suspense>
    </>
  );
}
