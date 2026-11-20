'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { analyticsQueries, type AgentAnalyticsData } from '@/lib/tickets/analyticsQueries';
import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';
import type { TeamMemberStats } from './StaffAnalyticsDashboard';
import { Button, Card, CardBody, EmptyState, PageHeader } from '@/components/ui';
import styles from '@/components/analytics/analytics.module.css';

const StaffAnalyticsDashboard = dynamic(
  () => import('./StaffAnalyticsDashboard').then((m) => m.StaffAnalyticsDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex-center" style={{ height: '45vh', flexDirection: 'column', gap: 16 }}>
        <Loader2 className="animate-spin" size={36} color="var(--color-primary)" />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          กำลังโหลดสรุปผลงานและข้อมูลกราฟ...
        </p>
      </div>
    ),
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

  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedAgentName, setSelectedAgentName] = useState<string>('');

  const [data, setData] = useState<AgentAnalyticsData | null>(null);
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);

  const [dateRange, setDateRange] = useState({
    start: DateTime.now().minus({ days: 30 }).toISODate()!,
    end: DateTime.now().toISODate()!,
  });

  const [activeRange, setActiveRange] = useState<'30days' | '7days'>('30days');

  const hasAccess = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'Administrator') return true;
    return userProfile.permissions?.analytics_staff === 'view' || userProfile.permissions?.analytics_staff === 'edit';
  }, [userProfile]);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const fetchAgentPerformance = useCallback(
    async (agentId: string) => {
      if (!agentId) return;
      setLoadingStats(true);
      try {
        const [stats, tStats] = await Promise.all([
          analyticsQueries.getAgentAnalytics(agentId, dateRange.start, dateRange.end),
          analyticsQueries.getTeamAnalytics(dateRange.start, dateRange.end),
        ]);
        setData(stats);
        setTeamStats(tStats);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoadingStats(false);
      }
    },
    [dateRange.start, dateRange.end]
  );

  useEffect(() => {
    if (selectedAgentId) {
      void fetchAgentPerformance(selectedAgentId);
    }
  }, [fetchAgentPerformance, selectedAgentId]);

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedAgentId(id);
    const agent = staffList.find((s) => s.id === id);
    if (agent) {
      setSelectedAgentName(agent.full_name);
    }
  };

  const handleRangeChange = (range: '30days' | '7days') => {
    setActiveRange(range);
    if (range === '30days') {
      setDateRange({
        start: DateTime.now().minus({ days: 30 }).toISODate()!,
        end: DateTime.now().toISODate()!,
      });
    } else {
      setDateRange({
        start: DateTime.now().minus({ days: 7 }).toISODate()!,
        end: DateTime.now().toISODate()!,
      });
    }
  };

  const showFullPageLoader = useMemo(() => {
    return loading || (loadingStats && !data);
  }, [loading, loadingStats, data]);

  if (!mounted) return null;

  if (!loading && !hasAccess) {
    return (
      <div className="flex-center" style={{ height: '65vh' }}>
        <Card style={{ maxWidth: 460 }}>
          <CardBody>
            <EmptyState
              icon={<ShieldAlert size={36} color="var(--color-danger)" aria-hidden="true" />}
              title="คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้"
              description="สิทธิ์การเข้าถึงข้อมูลแดชบอร์ดสถิติพนักงานระดับบริหารนี้ ถูกกำหนดไว้เฉพาะผู้ดูแลระบบหลักหรือผู้ได้รับมอบหมายพิเศษเท่านั้น"
              action={
                <Link href="/" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
                    กลับหน้าหลัก
                  </Button>
                </Link>
              }
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        title={locale === 'th' ? 'สถิติผลงานพนักงาน' : 'Staff Performance Analytics'}
        subtitle="ติดตามภาระงาน ประสิทธิภาพ และผลประเมินพนักงานรายบุคคล"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className={styles.segmentedGroup} role="group" aria-label="ช่วงเวลาย้อนหลัง">
              <button
                type="button"
                onClick={() => handleRangeChange('30days')}
                className={`${styles.segmentedBtn} ${activeRange === '30days' ? styles.segmentedBtnActive : ''}`}
              >
                30 วันล่าสุด
              </button>
              <button
                type="button"
                onClick={() => handleRangeChange('7days')}
                className={`${styles.segmentedBtn} ${activeRange === '7days' ? styles.segmentedBtnActive : ''}`}
              >
                7 วันล่าสุด
              </button>
            </div>

            <Button
              variant="secondary"
              size="md"
              iconOnly
              onClick={() => selectedAgentId && fetchAgentPerformance(selectedAgentId)}
              aria-label="รีเฟรชข้อมูลพนักงาน"
            >
              {loadingStats ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
            </Button>
          </div>
        }
      />

      {showFullPageLoader ? (
        <div className="flex-center" style={{ height: '45vh' }}>
          <Loader2 className="animate-spin" size={36} color="var(--color-primary)" />
        </div>
      ) : !data ? (
        <Card>
          <CardBody>
            <EmptyState title="ไม่มีข้อมูลสรุปสำหรับพนักงานคนนี้" />
          </CardBody>
        </Card>
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
