'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Users,
  TrendingDown,
  TrendingUp,
  Settings,
  MoreVertical,
  Calendar,
  Filter,
  FileDown,
  FileSpreadsheet
} from 'lucide-react';
import Link from 'next/link';
import { analyticsService } from '@/lib/services/analyticsService';
import { exportToExcel, exportToPDF } from '@/lib/utils/exportUtils';

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
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
          {trend.startsWith('+') ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {trend}
        </span>
      )}
    </div>
    <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>{title}</h3>
    <p style={{ fontSize: '28px', fontWeight: '800' }}>{value}</p>
  </div>
);

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>({ activeTickets: 0, resolvedToday: 0, slaBreached: 0, avgResponseTime: '0m' });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    const data = await analyticsService.getOverviewStats();
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
    // Intentionally omitted real-time Supabase subscriptions here 
    // to conserve DB read quotas. Uses On-Load + Manual Refresh.
  }, []);

  const handleExportSummary = () => {
     const data = [{
        'Total Workload': stats.activeTickets,
        'Resolved Today': stats.resolvedToday,
        'SLA Breached': stats.slaBreached,
        'Avg Response Time': stats.avgResponseTime,
        'Report Date': new Date().toLocaleString()
     }];
     exportToExcel(data, `Executive_Summary_${new Date().toISOString()}`);
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }} className="mobile-header-stack">
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>Executive Insights</h1>
          <p style={{ color: 'var(--text-muted)' }}>Decision-grade support performance analytics.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button 
           onClick={loadStats}
           disabled={loading}
           className="glass-interactive flex-center" 
           style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', gap: '8px', fontSize: '12px', fontWeight: 'bold' }}>
              <Clock size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button 
           onClick={handleExportSummary}
           className="glass-interactive flex-center" 
           style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', gap: '8px', fontSize: '12px', fontWeight: 'bold' }}>
              <FileSpreadsheet size={16} /> Export
          </button>
          <Link href="/settings/sla" style={{
            padding: '8px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--primary)', color: '#0a0e14', fontSize: '12px', fontWeight: '700'
          }}>
            <Settings size={16} /> SLA Rules
          </Link>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '32px' }}>
        <StatCard title="Total Workload" value={stats.activeTickets} icon={Users} color="var(--primary)" trendInternal="+5.4%" />
        <StatCard title="Resolved Today" value={stats.resolvedToday} icon={CheckCircle} color="var(--success)" trendInternal="+12.1%" />
        <StatCard title="SLA Breached" value={stats.slaBreached} icon={AlertTriangle} color="var(--danger)" trendInternal="-2.4%" />
        <StatCard title="Avg Response" value={stats.avgResponseTime} icon={Clock} color="var(--secondary)" trendInternal="-15s" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <div className="glass" style={{ padding: '24px', minHeight: '320px', display: 'flex', flexDirection: 'column' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700' }}>SLA Performance</h2>
              <Filter size={18} color="var(--text-muted)" />
           </div>
           
           <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 {[
                   { name: 'On-time Resolution', value: 92, color: 'var(--success)' },
                   { name: 'First-response SLA', value: 84, color: 'var(--primary)' },
                   { name: 'Customer Satisfaction', value: 96, color: 'var(--secondary)' },
                   { name: 'Escalation Threshold', value: 12, color: 'var(--danger)' }
                 ].map((bar, i) => (
                    <div key={i}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{bar.name}</span>
                          <span style={{ fontWeight: '700' }}>{bar.value}%</span>
                       </div>
                       <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${bar.value}%`, height: '100%', background: bar.color, borderRadius: '4px' }} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="glass" style={{ padding: '24px', minHeight: '320px', display: 'flex', flexDirection: 'column' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Agent Performance</h2>
              <MoreVertical size={18} color="var(--text-muted)" />
           </div>
           <div style={{ flex: 1, overflowY: 'auto' }}>
              {[
                { name: 'Neo Agent', role: 'Senior', tickets: 12, csat: 4.8 },
                { name: 'Wichai R.', role: 'Support', tickets: 8, csat: 4.5 },
                { name: 'Somsak J.', role: 'L1 Tech', tickets: 15, csat: 4.2 },
                { name: 'Mali S.', role: 'Sales', tickets: 4, csat: 4.9 },
              ].map((agent, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: i === 3 ? 'none' : '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>{agent.name.charAt(0)}</div>
                      <div>
                         <p style={{ fontSize: '14px', fontWeight: '600' }}>{agent.name}</p>
                         <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{agent.role}</p>
                      </div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '14px', fontWeight: '700' }}>{agent.tickets}</p>
                      <p style={{ fontSize: '11px', color: 'var(--success)' }}>⭐️ {agent.csat}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .mobile-header-stack {
            flex-direction: column;
            align-items: flex-start !important;
          }
        }
      `}</style>
    </div>
  );
}
