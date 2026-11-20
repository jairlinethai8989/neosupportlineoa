'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Star,
  TrendingUp,
  PieChart as PieIcon,
  Activity,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { analyticsQueries, type AgentAnalyticsData } from '@/lib/tickets/analyticsQueries';
import { DateTime } from 'luxon';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import styles from '@/components/analytics/analytics.module.css';

const CHART_COLORS = ['#1D4ED8', '#0D9488', '#059669', '#D97706', '#DC2626'];

export default function PersonalAnalyticsPage() {
  const { userProfile } = useAppContext();
  const { locale } = useStaffLocale();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AgentAnalyticsData | null>(null);

  const [dateRange, setDateRange] = useState({
    start: DateTime.now().minus({ days: 30 }).toISODate()!,
    end: DateTime.now().toISODate()!,
  });

  const [activeRange, setActiveRange] = useState<'30days' | '7days' | 'custom'>('30days');

  const hasAccess = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'Administrator') return true;
    return userProfile.permissions?.analytics_personal === 'view' || userProfile.permissions?.analytics_personal === 'edit';
  }, [userProfile]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAnalytics = useCallback(
    async (isRefresh = false) => {
      if (!userProfile?.id || !hasAccess) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const statsData = await analyticsQueries.getAgentAnalytics(userProfile.id, dateRange.start, dateRange.end);
        setData(statsData);
      } catch (err) {
        console.error('Failed to fetch personal analytics:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userProfile?.id, dateRange.start, dateRange.end, hasAccess]
  );

  useEffect(() => {
    if (userProfile?.id && hasAccess && mounted) {
      void fetchAnalytics();
    } else if (mounted) {
      setLoading(false);
    }
  }, [fetchAnalytics, userProfile?.id, hasAccess, mounted]);

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

  const getActionTypeLabel = (action: string) => {
    switch (action) {
      case 'claim':
        return 'รับเรื่องสิทธิ์งาน';
      case 'resolve':
        return 'ดำเนินการแก้ไขเสร็จสิ้น';
      case 'close':
        return 'ปิดใบงานสำเร็จ';
      case 'reject':
        return 'ส่งงานกลับไปแก้ไขต่อ';
      case 'assign':
        return 'มอบหมายงาน';
      case 'escalate':
        return 'ส่งต่อเรื่อง';
      case 'transfer':
        return 'โอนย้ายแอดมิน';
      default:
        return action;
    }
  };

  const getActionBadgeVariant = (action: string): 'success' | 'primary' | 'danger' | 'neutral' => {
    switch (action) {
      case 'resolve':
      case 'close':
        return 'success';
      case 'claim':
      case 'assign':
        return 'primary';
      case 'reject':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const filteredCategoryData = useMemo(() => {
    if (!data?.categoryData) return [];
    return data.categoryData.filter((d) => d.value > 0);
  }, [data?.categoryData]);

  const [currentTimelinePage, setCurrentTimelinePage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const totalTimelinePages = useMemo(() => {
    if (!data?.timeline) return 0;
    return Math.ceil(data.timeline.length / ITEMS_PER_PAGE);
  }, [data?.timeline]);

  const paginatedTimeline = useMemo(() => {
    if (!data?.timeline) return [];
    const startIndex = (currentTimelinePage - 1) * ITEMS_PER_PAGE;
    return data.timeline.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [data?.timeline, currentTimelinePage]);

  useEffect(() => {
    setCurrentTimelinePage(1);
  }, [dateRange.start, dateRange.end]);

  if (!mounted) return null;

  if (!loading && !hasAccess) {
    return (
      <div className="flex-center" style={{ height: '65vh' }}>
        <Card style={{ maxWidth: 460 }}>
          <CardBody>
            <EmptyState
              icon={<ShieldAlert size={36} color="var(--color-danger)" aria-hidden="true" />}
              title="คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้"
              description="สิทธิ์การเข้าถึงข้อมูลผลงานของฉัน ถูกกำหนดไว้เฉพาะผู้ดูแลระบบหลักหรือผู้ได้รับมอบหมายสิทธิ์เท่านั้น"
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
        title={locale === 'th' ? 'ผลงานของฉัน' : 'My Performance'}
        subtitle={`${userProfile?.full_name || ''} • ${((userProfile as unknown) as { department?: string })?.department || 'Staff/Agent'}`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              onClick={() => fetchAnalytics(true)}
              aria-label="รีเฟรชข้อมูล"
            >
              {refreshing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex-center" style={{ height: '45vh' }}>
          <Loader2 className="animate-spin" size={36} color="var(--color-primary)" />
        </div>
      ) : !data ? (
        <Card>
          <CardBody>
            <EmptyState title="ไม่สามารถโหลดข้อมูลสถิติการทำงานได้" />
          </CardBody>
        </Card>
      ) : (
        <>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }} aria-hidden="true">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className={styles.kpiLabel}>งานที่ปิดเสร็จสิ้น</p>
                <p className={styles.kpiValue}>{data.stats.resolvedCount}</p>
                <p className={styles.kpiSub}>จากทั้งหมด {data.stats.totalClaimed} เคส</p>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }} aria-hidden="true">
                <Clock size={20} />
              </div>
              <div>
                <p className={styles.kpiLabel}>เวลาปิดงานเฉลี่ย</p>
                <p className={styles.kpiValue}>
                  {data.stats.avgResolutionTime} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>ชม.</span>
                </p>
                <p className={styles.kpiSub}>
                  SLA ผ่านเกณฑ์ <strong style={{ color: 'var(--color-success-text)' }}>{data.stats.slaComplianceRate}%</strong>
                </p>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }} aria-hidden="true">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className={styles.kpiLabel}>อัตราการส่งกลับแก้</p>
                <p className={styles.kpiValue}>{data.stats.reworkRate}%</p>
                <p className={styles.kpiSub}>โดนตีกลับ {data.stats.reworkCount} ครั้ง</p>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }} aria-hidden="true">
                <Star size={20} />
              </div>
              <div>
                <p className={styles.kpiLabel}>ความพึงพอใจ CSAT</p>
                <p className={styles.kpiValue}>
                  {data.stats.avgCsat > 0 ? `${data.stats.avgCsat} / 5` : 'ไม่มีประเมิน'}
                </p>
                <div style={{ display: 'flex', gap: 2, marginTop: 6 }} aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={12}
                      fill={i < Math.round(data.stats.avgCsat) ? 'var(--color-warning)' : 'transparent'}
                      color="var(--color-warning)"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.twoColGrid}>
            <Card>
              <CardHeader>
                <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} color="var(--color-primary)" aria-hidden="true" />
                  ปริมาณงานของฉัน
                </h2>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.workloadTrend}>
                    <defs>
                      <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--color-text-subtle)" fontSize={12} axisLine={false} tickLine={false} />
                    <YAxis stroke="var(--color-text-subtle)" fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)' }}
                      labelStyle={{ fontWeight: 600, fontSize: 12, color: 'var(--color-text)' }}
                      itemStyle={{ fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="received" name="งานที่รับ" stroke="#1D4ED8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReceived)" />
                    <Area type="monotone" dataKey="closed" name="งานที่ปิด" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#colorClosed)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieIcon size={16} color="var(--color-info)" aria-hidden="true" />
                  กราฟประเภทงาน
                </h2>
              </CardHeader>
              <CardBody>
                {filteredCategoryData.length === 0 ? (
                  <EmptyState compact title="ไม่มีข้อมูลงานในระบบ" />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16 }}>
                    <ResponsiveContainer width={190} height={210}>
                      <PieChart>
                        <Pie data={filteredCategoryData} innerRadius={52} outerRadius={78} paddingAngle={4} dataKey="value" strokeWidth={0}>
                          {filteredCategoryData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {filteredCategoryData.map((entry, idx) => (
                        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>{entry.name}</span>
                          <span className="tabular-nums" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                            ({entry.value} ใบงาน)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} color="var(--color-warning)" aria-hidden="true" />
                บันทึกกิจกรรมการทำงานล่าสุด
              </h2>
            </CardHeader>
            <CardBody>
              {paginatedTimeline.length === 0 ? (
                <EmptyState compact title="ไม่มีกิจกรรมบันทึกในช่วงเวลานี้" />
              ) : (
                <>
                  <div className={styles.timelineList}>
                    {paginatedTimeline.map((item, idx) => (
                      <div key={item.id || idx} className={styles.timelineItem}>
                        <div className={styles.timelineBulletCol}>
                          <div
                            className={styles.timelineDot}
                            style={{
                              background:
                                item.action === 'resolve' || item.action === 'close'
                                  ? 'var(--color-success)'
                                  : item.action === 'reject'
                                    ? 'var(--color-danger)'
                                    : 'var(--color-primary)',
                            }}
                          />
                          {idx < paginatedTimeline.length - 1 ? <div className={styles.timelineLine} /> : null}
                        </div>

                        <div className={styles.timelineContent}>
                          <div className={styles.timelineHeader}>
                            <div className={styles.timelineMeta}>
                              <span className="tabular-nums" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                                {item.ticketNo}
                              </span>
                              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{item.subject}</span>
                              <Badge variant={getActionBadgeVariant(item.action)} size="sm">
                                {getActionTypeLabel(item.action)}
                              </Badge>
                            </div>
                            <span className="tabular-nums" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                              {DateTime.fromISO(item.createdAt).toFormat('dd MMM yyyy, HH:mm น.')}
                            </span>
                          </div>

                          {item.note ? (
                            <div className={styles.timelineNote}>
                              <strong style={{ color: 'var(--color-text)', marginRight: 6 }}>บันทึก:</strong>
                              {item.note}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalTimelinePages > 1 ? (
                    <div className={styles.paginationBar}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentTimelinePage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentTimelinePage === 1}
                      >
                        ย้อนกลับ
                      </Button>
                      <span className="tabular-nums" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        หน้า <strong style={{ color: 'var(--color-primary)' }}>{currentTimelinePage}</strong> จาก {totalTimelinePages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentTimelinePage((prev) => Math.min(prev + 1, totalTimelinePages))}
                        disabled={currentTimelinePage === totalTimelinePages}
                      >
                        ถัดไป
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
