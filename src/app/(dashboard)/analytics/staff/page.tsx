'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users,
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Star, 
  TrendingUp, 
  PieChart as PieIcon, 
  BarChart as BarIcon,
  Activity,
  ArrowLeft,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { analyticsQueries, type AgentAnalyticsData } from '@/lib/tickets/analyticsQueries';
import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';
import {
  ResponsiveContainer,
  AreaChart, Area,
  PieChart, Pie, Cell,
  BarChart as RechartsBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

const CHART_COLORS = ['#00f2fe', '#7367f0', '#28c76f', '#ff9f43', '#ea5455'];
const SLA_COLORS = ['#28c76f', '#ea5455'];

interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
  status: string;
}

export default function StaffAnalyticsPage() {
  const { userProfile } = useAppContext();
  const { locale } = useStaffLocale();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Staff Profiles List
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedAgentName, setSelectedAgentName] = useState<string>('');
  
  const [data, setData] = useState<AgentAnalyticsData | null>(null);
  
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
      const stats = await analyticsQueries.getAgentAnalytics(
        agentId,
        dateRange.start,
        dateRange.end
      );
      setData(stats);
    } catch (err) {
      console.error('Failed to fetch agent stats:', err);
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

  const filteredSlaData = useMemo(() => {
    if (!data?.slaData) return [];
    return data.slaData.filter(d => d.value > 0);
  }, [data?.slaData]);

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

  // Reset timeline page when agent or dates change
  useEffect(() => {
    setCurrentTimelinePage(1);
  }, [selectedAgentId, dateRange.start, dateRange.end]);

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

        {/* Date Selector & Staff Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Agent Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedAgentId}
              onChange={handleAgentChange}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '10px 40px 10px 16px',
                color: 'var(--text-main)',
                fontWeight: '700',
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                minWidth: '200px'
              }}
            >
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name} ({staff.role})
                </option>
              ))}
            </select>
            <ChevronDown size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

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

      {loading || loadingStats ? (
        <div className="flex-center" style={{ height: '50vh' }}>
          <Loader2 className="animate-spin" size={40} color="var(--primary)" />
        </div>
      ) : !data ? (
        <div className="glass flex-center" style={{ padding: '64px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>ไม่มีข้อมูลสรุปสำหรับพนักงานคนนี้</p>
        </div>
      ) : (
        <>
          {/* Executive Overview Banner */}
          <div className="glass" style={{ padding: '24px 32px', marginBottom: '32px', background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.05) 0%, rgba(115, 103, 240, 0.05) 100%)', border: '1px solid var(--border-active)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '16px', borderRadius: '16px', color: 'var(--primary)' }}>
                <Users size={32} />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>รายงานสรุปผลงานระดับรายบุคคล</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                  กำลังตรวจสอบสถิติการปฏิบัติงานของ <strong>{selectedAgentName}</strong> ตั้งแต่วันที่ {DateTime.fromISO(dateRange.start).toFormat('dd MMM')} ถึง {DateTime.fromISO(dateRange.end).toFormat('dd MMM yyyy')} รวมประวัติและ CSAT ย้อนหลังทั้งหมด
                </p>
              </div>
            </div>
          </div>

          {/* KPI Analytics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ background: 'rgba(40, 199, 111, 0.1)', padding: '12px', borderRadius: '14px' }}>
                <CheckCircle size={24} color="var(--success)" />
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>ใบงานที่ปิดแล้ว</p>
                <h3 style={{ fontSize: '28px', fontWeight: '850', color: 'var(--text-main)', marginTop: '4px' }}>{data.stats.resolvedCount}</h3>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>จากทั้งหมด {data.stats.totalClaimed} เคส</span>
              </div>
            </div>

            <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '12px', borderRadius: '14px' }}>
                <Clock size={24} color="var(--primary)" />
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>เวลาปิดงานเฉลี่ย</p>
                <h3 style={{ fontSize: '28px', fontWeight: '850', color: 'var(--text-main)', marginTop: '4px' }}>
                  {data.stats.avgResolutionTime} <span style={{ fontSize: '14px', fontWeight: '600' }}>ชม.</span>
                </h3>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>SLA ผ่านเกณฑ์ {data.stats.slaComplianceRate}%</span>
              </div>
            </div>

            <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
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
            </div>

            <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
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
            </div>
          </div>

          {/* Graphics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            {/* Resolution Trend Chart */}
            <div className="glass" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--primary)' }}>
                  <TrendingUp size={16} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>แนวโน้มการแก้ไขงานรายวัน</h3>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.resolutionTrend}>
                  <defs>
                    <linearGradient id="colorValueStaff" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                    labelStyle={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-main)' }}
                    itemStyle={{ color: 'var(--primary)', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValueStaff)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* SLA Compliance Gauge Chart */}
            <div className="glass" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                <div style={{ background: 'rgba(40, 199, 111, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--success)' }}>
                  <PieIcon size={16} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>อัตราการรักษาสัญญา SLA</h3>
              </div>

              {filteredSlaData.length === 0 ? (
                <div className="flex-center" style={{ height: '260px', color: 'var(--text-muted)' }}>พนักงานไม่มีเคสที่ติดเงื่อนไข SLA</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px' }}>
                  <ResponsiveContainer width={180} height={200}>
                    <PieChart>
                      <Pie
                        data={filteredSlaData}
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {filteredSlaData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={SLA_COLORS[index % SLA_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ความถูกต้องตามเกณฑ์</p>
                      <p style={{ fontSize: '24px', fontWeight: '900', color: 'var(--success)' }}>{data.stats.slaComplianceRate}%</p>
                    </div>
                    {filteredSlaData.map((entry, idx) => (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: SLA_COLORS[idx % SLA_COLORS.length] }} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{entry.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({entry.value} ใบงาน)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Problem Category horizontal Bar Chart */}
            <div className="glass" style={{ padding: '24px', gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                <div style={{ background: 'rgba(115, 103, 240, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--secondary)' }}>
                  <BarIcon size={16} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>สัดส่วนประเภทปัญหาที่ดูแลสูงสุด (Top Categories Handled)</h3>
              </div>

              {data.categoryData.length === 0 ? (
                <div className="flex-center" style={{ height: '240px', color: 'var(--text-muted)' }}>ไม่มีข้อมูลบันทึกประเภทปัญหา</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <RechartsBarChart layout="vertical" data={data.categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} width={150} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                    <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={16}>
                      {data.categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Timeline and History log */}
          <div className="glass" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
              <div style={{ background: 'rgba(255, 159, 67, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--warning)' }}>
                <Activity size={16} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>บันทึกประวัติการทำงานของพนักงานล่าสุด (Employee Activity Log)</h3>
            </div>

            {paginatedTimeline.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                ไม่มีบันทึกประวัติการทำงานล่าสุดในช่วงเวลานี้
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {paginatedTimeline.map((item, idx) => (
                  <div key={item.id || idx} style={{ display: 'flex', gap: '16px', borderBottom: idx < paginatedTimeline.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', paddingBottom: '16px' }}>
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
