'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessageSquare, 
  Clock, 
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  Download,
  Save,
  Ticket
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const KPICard = ({ title, value, icon: Icon, color, trend }: any) => (
  <div className="glass-interactive" style={{ padding: '24px', flex: 1, minWidth: '240px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div style={{ 
        background: `${color}15`, 
        color: color, 
        padding: '12px', 
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={24} />
      </div>
      {trend && (
        <span style={{ 
          fontSize: '12px', 
          color: trend.startsWith('+') ? 'var(--success)' : 'var(--danger)',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {trend !== '-' && <TrendingUp size={14} />}
          {trend}
        </span>
      )}
    </div>
    <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span>{title.thai}</span>
        <span style={{ fontSize: '9px', opacity: 0.7 }}>{title.eng}</span>
      </div>
    </h3>
    <p style={{ fontSize: '28px', fontWeight: '800' }}>{value}</p>
  </div>
);

export default function Home() {
  const [stats, setStats] = useState({
    totalToday: 0,
    newTickets: 0,
    inProgress: 0,
    pending: 0
  });

  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboard() {
      // 1. Fetch Stats
      const { data: tickets } = await supabase.from('tickets').select('*');
      if (tickets) {
         const todayStart = new Date();
         todayStart.setHours(0, 0, 0, 0);
         
         setStats({
           totalToday: tickets.filter(t => new Date(t.created_at) >= todayStart).length,
           newTickets: tickets.filter(t => t.status === 'New').length,
           inProgress: tickets.filter(t => t.status === 'In Progress').length,
           pending: tickets.filter(t => t.status === 'Pending').length
         });
      }

      // 2. Fetch Recent Activities
      const { data: logs } = await supabase
        .from('ticket_logs')
        .select(`*, tickets(ticket_no)`)
        .order('created_at', { ascending: false })
        .limit(5);
      if (logs) setRecentLogs(logs);
    }
    fetchDashboard();

    const channel = supabase.channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_logs' }, fetchDashboard)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>สรุปผลบริหารจัดการ</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EXECUTIVE SUMMARY • Real-time overview</p>
        </div>
        <button className="glass-interactive flex-center" style={{ 
          padding: '12px 24px', 
          background: 'var(--primary)', 
          color: 'black', 
          border: 'none', 
          fontWeight: '800',
          borderRadius: '14px',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(0, 242, 254, 0.3)'
        }}>
          <Download size={20} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
            <span style={{ fontSize: '14px' }}>ส่งออกรายงาน</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>EXPORT REPORT</span>
          </div>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <KPICard title={{ thai: 'ใบงานทั้งหมดวันนี้', eng: 'TOTAL TICKETS TODAY' }} value={stats.totalToday} icon={Ticket} color="#00cfe8" trend="-" />
        <KPICard title={{ thai: 'ใบงานมาใหม่', eng: 'NEW TICKETS' }} value={stats.newTickets} icon={MessageSquare} color="#00f2fe" trend="-" />
        <KPICard title={{ thai: 'ใบงานที่กำลังดำเนินงาน', eng: 'IN PROGRESS' }} value={stats.inProgress} icon={Clock} color="#ff9f43" trend="-" />
        <KPICard title={{ thai: 'ใบงานรอดำเนินการ', eng: 'PENDING' }} value={stats.pending} icon={AlertTriangle} color="#ea5455" trend="-" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="glass" style={{ padding: '24px', height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px' }}>แนวโน้มใบงาน (WORK ORDER TREND)</h2>
          <div style={{ flex: 1, position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }} className="flex-center">
             <p style={{ color: 'var(--text-muted)' }}>Real-time chart visualization mapping...</p>
          </div>
        </div>

        <div className="glass" style={{ padding: '24px', height: '400px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px' }}>กิจกรรมล่าสุด (RECENT ACTIVITY)</h2>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {recentLogs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>No recent activities</p>
            ) : recentLogs.map((log, idx) => (
              <div key={idx} style={{ 
                padding: '12px 0', 
                borderBottom: idx === recentLogs.length - 1 ? 'none' : '1px solid var(--border)',
                display: 'flex',
                gap: '12px',
                alignItems: 'start'
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', marginTop: '6px' }} />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600' }}>#{log.tickets?.ticket_no} - {log.action_type}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{log.note || 'Status updated automatically.'}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                     {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
