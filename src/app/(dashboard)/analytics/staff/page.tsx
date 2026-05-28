'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ArrowLeft,
  Loader2,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { analyticsQueries, type AgentAnalyticsData } from '@/lib/tickets/analyticsQueries';
import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';
import type { TeamMemberStats } from './StaffAnalyticsDashboard';

// Dynamically import StaffAnalyticsDashboard with a loader skeleton
const StaffAnalyticsDashboard = dynamic(
  () => import('./StaffAnalyticsDashboard').then(m => m.StaffAnalyticsDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex-center" style={{ height: '50vh', flexDirection: 'column', gap: '16px' }}>
        <Loader2 className="animate-spin" size={40} color="var(--primary)" />
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>กำลังโหลดสรุปผลงานและข้อมูลกราฟ...</p>
      </div>
    )
  }
);

interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
  status: string;
}

export default function StaffAnalyticsPage() {
  const { userProfile } = useAppContext();
  const { locale } = useStaffLocale();
  const { addToast } = useNotificationContext();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Staff Profiles List
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedAgentName, setSelectedAgentName] = useState<string>('');
  
  const [data, setData] = useState<AgentAnalyticsData | null>(null);
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  
  const [dateRange, setDateRange] = useState({
    start: DateTime.now().minus({ days: 30 }).toISODate()!,
    end: DateTime.now().toISODate()!
  });

  const [activeRange, setActiveRange] = useState<'30days' | '7days'>('30days');

  // Security authorization check
  const hasAccess = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'Administrator') return true;
    return userProfile.permissions?.analytics_staff === 'view' || userProfile.permissions?.analytics_staff === 'edit';
  }, [userProfile]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch all staff members to populate the selector
  const fetchStaffList = useCallback(async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, status')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setStaffList(profiles || []);

      if (profiles && profiles.length > 0) {
        setSelectedAgentId(profiles[0].id);
        setSelectedAgentName(profiles[0].full_name);
      }
    } catch (err) {
      console.error('Failed to fetch staff list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess && mounted) {
      void fetchStaffList();
    } else if (mounted) {
      setLoading(false);
    }
  }, [fetchStaffList, hasAccess, mounted]);

  // Fetch performance data for the selected agent
  const fetchAgentPerformance = useCallback(async (agentId: string) => {
    if (!agentId) return;
    setLoadingStats(true);
    try {
      const [stats, tStats] = await Promise.all([
        analyticsQueries.getAgentAnalytics(agentId, dateRange.start, dateRange.end),
        analyticsQueries.getTeamAnalytics(dateRange.start, dateRange.end)
      ]);
      setData(stats);
      setTeamStats(tStats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    if (selectedAgentId) {
      void fetchAgentPerformance(selectedAgentId);
    }
  }, [fetchAgentPerformance, selectedAgentId]);

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedAgentId(id);
    const agent = staffList.find(s => s.id === id);
    if (agent) {
      setSelectedAgentName(agent.full_name);
    }
  };

  const handleRangeChange = (range: '30days' | '7days') => {
    setActiveRange(range);
    if (range === '30days') {
      setDateRange({
        start: DateTime.now().minus({ days: 30 }).toISODate()!,
        end: DateTime.now().toISODate()!
      });
    } else {
      setDateRange({
        start: DateTime.now().minus({ days: 7 }).toISODate()!,
        end: DateTime.now().toISODate()!
      });
    }
  };

  const showFullPageLoader = useMemo(() => {
    return loading || (loadingStats && !data);
  }, [loading, loadingStats, data]);

  if (!mounted) return null;

  // Unauthorised fallback view
  if (!loading && !hasAccess) {
    return (
      <div className="flex-center" style={{ height: '70vh', animation: 'fadeIn 0.5s ease-out' }}>
        <div className="glass" style={{ maxWidth: '480px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(234, 84, 85, 0.1)', padding: '16px', borderRadius: '50%', color: 'var(--danger)' }}>
            <ShieldAlert size={48} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)' }}>คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            สิทธิ์การเข้าถึงข้อมูลแดชบอร์ดสถิติพนักงานระดับบริหารนี้ ถูกกำหนดไว้เฉพาะผู้ดูแลระบบหลักหรือผู้ได้รับมอบหมายพิเศษเท่านั้น
          </p>
          <Link href="/" className="glass-interactive" style={{ padding: '12px 24px', background: 'var(--primary)', color: '#0a0e14', fontWeight: '800', borderRadius: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeft size={16} /> กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Top Header Selector Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.1', color: 'var(--text-main)' }}>
            {locale === 'th' ? 'สถิติผลงานพนักงาน' : 'Staff Performance Analytics'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
            Executive Dashboards & Performance Insights
          </p>
        </div>

        {/* Date Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Range Selection */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <button 
              onClick={() => handleRangeChange('30days')}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                background: activeRange === '30days' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: activeRange === '30days' ? 'var(--primary)' : 'var(--text-dim)',
                transition: 'all 0.2s'
              }}
            >
              30 วันล่าสุด
            </button>
            <button 
              onClick={() => handleRangeChange('7days')}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                background: activeRange === '7days' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: activeRange === '7days' ? 'var(--primary)' : 'var(--text-dim)',
                transition: 'all 0.2s'
              }}
            >
              7 วันล่าสุด
            </button>
          </div>

          <button 
            onClick={() => selectedAgentId && fetchAgentPerformance(selectedAgentId)}
            className="glass-interactive"
            style={{ padding: '10px', borderRadius: '12px', color: 'var(--text-muted)' }}
          >
            {loadingStats ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
        </div>
      </div>

      {showFullPageLoader ? (
        <div className="flex-center" style={{ height: '50vh' }}>
          <Loader2 className="animate-spin" size={40} color="var(--primary)" />
        </div>
      ) : !data ? (
        <div className="glass flex-center" style={{ padding: '64px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>ไม่มีข้อมูลสรุปสำหรับพนักงานคนนี้</p>
        </div>
      ) : (
        <StaffAnalyticsDashboard
          data={data}
          teamStats={teamStats}
          selectedAgentId={selectedAgentId}
          selectedAgentName={selectedAgentName}
          dateRange={dateRange}
          staffList={staffList}
          handleAgentChange={handleAgentChange}
          addToast={addToast}
        />
      )}
    </div>
  );
}
