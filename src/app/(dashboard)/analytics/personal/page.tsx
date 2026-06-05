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
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { analyticsQueries, type AgentAnalyticsData } from '@/lib/tickets/analyticsQueries';
import { DateTime } from 'luxon';
import {
  ResponsiveContainer,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#ea5455',
  High: '#ff9f43',
  Medium: '#7367f0',
  Low: '#28c76f'
};

const CHART_COLORS = ['#00f2fe', '#7367f0', '#28c76f', '#ff9f43', '#ea5455'];

export default function PersonalAnalyticsPage() {
  const { userProfile } = useAppContext();
  const { locale } = useStaffLocale();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AgentAnalyticsData | null>(null);
  
  const [dateRange, setDateRange] = useState({
    start: DateTime.now().minus({ days: 30 }).toISODate()!,
    end: DateTime.now().toISODate()!
  });

  const [activeRange, setActiveRange] = useState<'30days' | '7days' | 'custom'>('30days');

  // Security authorization check
  const hasAccess = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'Administrator') return true;
    return userProfile.permissions?.analytics_personal === 'view' || userProfile.permissions?.analytics_personal === 'edit';
  }, [userProfile]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    if (!userProfile?.id || !hasAccess) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const statsData = await analyticsQueries.getAgentAnalytics(
        userProfile.id,
        dateRange.start,
        dateRange.end
      );
      setData(statsData);
    } catch (err) {
      console.error('Failed to fetch personal analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.id, dateRange.start, dateRange.end, hasAccess]);

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
        end: DateTime.now().toISODate()!
      });
    } else {
      setDateRange({
        start: DateTime.now().minus({ days: 7 }).toISODate()!,
        end: DateTime.now().toISODate()!
      });
    }
  };

  const getActionTypeLabel = (action: string) => {
    switch (action) {
      case 'claim': return 'รับเรื่องสิทธิ์งาน';
      case 'resolve': return 'ดำเนินการแก้ไขเสร็จสิ้น';
      case 'close': return 'ปิดใบงานสำเร็จ';
      case 'reject': return 'ส่งงานกลับไปแก้ไขต่อ';
      case 'assign': return 'มอบหมายงาน';
      case 'escalate': return 'ส่งต่อเรื่อง';
      case 'transfer': return 'โอนย้ายแอดมิน';
      default: return action;
    }
  };

  const getActionBadgeStyle = (action: string) => {
    switch (action) {
      case 'resolve':
      case 'close':
        return { background: 'rgba(40, 199, 111, 0.1)', color: 'var(--success)', border: '1px solid rgba(40, 199, 111, 0.2)' };
      case 'claim':
      case 'assign':
        return { background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary)', border: '1px solid rgba(0, 242, 254, 0.2)' };
      case 'reject':
        return { background: 'rgba(234, 84, 85, 0.1)', color: 'var(--danger)', border: '1px solid rgba(234, 84, 85, 0.2)' };
      default:
        return { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.1)' };
    }
  };

  // Pre-process category chart data to prevent empty slices
  const filteredCategoryData = useMemo(() => {
    if (!data?.categoryData) return [];
    return data.categoryData.filter(d => d.value > 0);
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

  // Reset timeline page when dates change
  useEffect(() => {
    setCurrentTimelinePage(1);
  }, [dateRange.start, dateRange.end]);

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
            สิทธิ์การเข้าถึงข้อมูลผลงานของฉัน ถูกกำหนดไว้เฉพาะผู้ดูแลระบบหลักหรือผู้ได้รับมอบหมายสิทธิ์เท่านั้น
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
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.1', color: 'var(--text-main)' }}>
            {locale === 'th' ? 'ผลงานของฉัน' : 'My Performance'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
            {userProfile?.full_name} • {((userProfile as unknown) as { department?: string })?.department || 'Staff/Agent'}
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            onClick={() => fetchAnalytics(true)}
            className="glass-interactive"
            style={{ padding: '10px', borderRadius: '12px', color: 'var(--text-muted)' }}
          >
            {refreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: '50vh' }}>
          <Loader2 className="animate-spin" size={40} color="var(--primary)" />
        </div>
      ) : !data ? (
        <div className="glass flex-center" style={{ padding: '64px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>ไม่สามารถโหลดข้อมูลสถิติการทำงานได้</p>
        </div>
      ) : (
        <>
          {/* KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            {/* KPI 1 */}
            <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ background: 'rgba(40, 199, 111, 0.1)', padding: '12px', borderRadius: '14px' }}>
                <CheckCircle size={24} color="var(--success)" />
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>งานที่ปิดเสร็จสิ้น</p>
                <h3 style={{ fontSize: '28px', fontWeight: '850', color: 'var(--text-main)', marginTop: '4px' }}>{data.stats.resolvedCount}</h3>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>จากทั้งหมด {data.stats.totalClaimed} เคส</span>
              </div>
              <div style={{ position: 'absolute', right: '-10px', bottom: '-15px', opacity: 0.05, transform: 'scale(1.5)' }}>
                <CheckCircle size={96} color="var(--success)" />
              </div>
            </div>

            {/* KPI 2 (Average Close Time - Re-themed for Readability) */}
            <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ background: 'var(--primary-transparent)', padding: '12px', borderRadius: '14px' }}>
                <Clock size={24} color="var(--primary)" />
              </div>
              <div style={{ zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>เวลาปิดงานเฉลี่ย</p>
                  <span style={{ fontSize: '9px', background: 'var(--primary-transparent)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>SPEED METRIC</span>
                </div>
                <h3 style={{ fontSize: '28px', fontWeight: '850', color: 'var(--text-main)', marginTop: '4px' }}>
                  {data.stats.avgResolutionTime} <span style={{ fontSize: '14px', fontWeight: '600' }}>ชม.</span>
                </h3>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                  SLA ผ่านเกณฑ์ <span style={{ color: 'var(--success)', fontWeight: '700' }}>{data.stats.slaComplianceRate}%</span>
                </span>
              </div>
              <div style={{ position: 'absolute', right: '-10px', bottom: '-15px', opacity: 0.05, transform: 'scale(1.5)', zIndex: 0 }}>
                <Clock size={96} color="var(--primary)" />
              </div>
            </div>

            {/* KPI 3 */}
            <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ background: 'rgba(234, 84, 85, 0.1)', padding: '12px', borderRadius: '14px' }}>
                <AlertTriangle size={24} color="var(--danger)" />
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>อัตราการส่งกลับแก้</p>
                <h3 style={{ fontSize: '28px', fontWeight: '850', color: 'var(--text-main)', marginTop: '4px' }}>
                  {data.stats.reworkRate}%
                </h3>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>โดนตีกลับ {data.stats.reworkCount} ครั้ง</span>
              </div>
              <div style={{ position: 'absolute', right: '-10px', bottom: '-15px', opacity: 0.05, transform: 'scale(1.5)' }}>
                <AlertTriangle size={96} color="var(--danger)" />
              </div>
            </div>

            {/* KPI 4 */}
            <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ background: 'rgba(255, 159, 67, 0.1)', padding: '12px', borderRadius: '14px' }}>
                <Star size={24} color="var(--warning)" />
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>ความพึงพอใจ CSAT</p>
                <h3 style={{ fontSize: '28px', fontWeight: '850', color: 'var(--text-main)', marginTop: '4px' }}>
                  {data.stats.avgCsat > 0 ? `${data.stats.avgCsat} / 5` : 'ไม่มีประเมิน'}
                </h3>
                <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star 
                      key={i} 
                      size={10} 
                      fill={i < Math.round(data.stats.avgCsat) ? 'var(--warning)' : 'transparent'} 
                      color="var(--warning)" 
                    />
                  ))}
                </div>
              </div>
              <div style={{ position: 'absolute', right: '-10px', bottom: '-15px', opacity: 0.05, transform: 'scale(1.5)' }}>
                <Star size={96} color="var(--warning)" />
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            {/* Workload Volume Trend */}
            <div className="glass" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--primary)' }}>
                    <TrendingUp size={16} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>ปริมาณงานของฉัน</h3>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.workloadTrend}>
                  <defs>
                    <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                    labelStyle={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-main)' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="received" name="งานที่รับ" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorReceived)" />
                  <Area type="monotone" dataKey="closed" name="งานที่ปิด" stroke="var(--success)" strokeWidth={3} fillOpacity={1} fill="url(#colorClosed)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Workload by Category */}
            <div className="glass" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'rgba(115, 103, 240, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--secondary)' }}>
                    <PieIcon size={16} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>กราฟประเภทงาน</h3>
                </div>
              </div>

              {filteredCategoryData.length === 0 ? (
                <div className="flex-center" style={{ height: '260px', color: 'var(--text-muted)' }}>ไม่มีข้อมูลงานในระบบ</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px' }}>
                  <ResponsiveContainer width={180} height={200}>
                    <PieChart>
                      <Pie
                        data={filteredCategoryData}
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {filteredCategoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredCategoryData.map((entry, idx) => (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{entry.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({entry.value} ใบงาน)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline and History log */}
          <div className="glass" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
              <div style={{ background: 'rgba(255, 159, 67, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--warning)' }}>
                <Activity size={16} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>บันทึกกิจกรรมการทำงานล่าสุด (Activity History)</h3>
            </div>

            {paginatedTimeline.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                ไม่มีกิจกรรมบันทึกในช่วงเวลานี้
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {paginatedTimeline.map((item, idx) => (
                  <div key={item.id || idx} style={{ display: 'flex', gap: '16px', borderBottom: idx < paginatedTimeline.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', paddingBottom: '16px' }}>
                    {/* Bullet */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '50%', 
                        background: item.action === 'resolve' || item.action === 'close' ? 'var(--success)' : item.action === 'reject' ? 'var(--danger)' : 'var(--primary)',
                        boxShadow: '0 0 10px rgba(0,242,254,0.3)',
                        marginTop: '4px'
                      }} />
                      {idx < paginatedTimeline.length - 1 && (
                        <div style={{ width: '2px', flex: 1, background: 'rgba(255,255,255,0.05)', marginTop: '8px' }} />
                      )}
                    </div>

                    {/* Timeline Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>{item.ticketNo}</span>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.subject}</span>
                          <span 
                            style={{ 
                              fontSize: '10px', 
                              padding: '2px 8px', 
                              borderRadius: '6px', 
                              fontWeight: '800', 
                              ...getActionBadgeStyle(item.action) 
                            }}
                          >
                            {getActionTypeLabel(item.action)}
                          </span>
                        </div>

                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          {DateTime.fromISO(item.createdAt).toFormat('dd MMM yyyy, HH:mm น.')}
                        </span>
                      </div>

                      {item.note && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px', marginTop: '8px', fontSize: '13px', color: 'var(--text-dim)' }}>
                          <span style={{ fontWeight: '700', color: 'var(--text-muted)', marginRight: '6px' }}>บันทึก:</span>
                          {item.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Pagination Controls */}
                {totalTimelinePages > 1 && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: '16px', 
                    marginTop: '24px', 
                    paddingTop: '20px', 
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <button
                      onClick={() => setCurrentTimelinePage(prev => Math.max(prev - 1, 1))}
                      disabled={currentTimelinePage === 1}
                      className="glass-interactive"
                      style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        background: currentTimelinePage === 1 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: currentTimelinePage === 1 ? 'var(--text-dim)' : 'var(--text-main)',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: currentTimelinePage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentTimelinePage === 1 ? 0.4 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      ย้อนกลับ
                    </button>
                    
                    <span style={{ 
                      fontSize: '13px', 
                      color: 'var(--text-muted)', 
                      fontWeight: '600'
                    }}>
                      หน้า <span style={{ color: 'var(--primary)', fontWeight: '800' }}>{currentTimelinePage}</span> จาก {totalTimelinePages}
                    </span>
                    
                    <button
                      onClick={() => setCurrentTimelinePage(prev => Math.min(prev + 1, totalTimelinePages))}
                      disabled={currentTimelinePage === totalTimelinePages}
                      className="glass-interactive"
                      style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        background: currentTimelinePage === totalTimelinePages ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: currentTimelinePage === totalTimelinePages ? 'var(--text-dim)' : 'var(--text-main)',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: currentTimelinePage === totalTimelinePages ? 'not-allowed' : 'pointer',
                        opacity: currentTimelinePage === totalTimelinePages ? 0.4 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      ถัดไป
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
