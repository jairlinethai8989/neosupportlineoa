'use client';

import React from 'react';
import { 
  Users, 
  MessageSquare, 
  Clock, 
  CheckCircle,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

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
          <TrendingUp size={14} />
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
  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>สรุปผลบริหารจัดการ</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EXECUTIVE SUMMARY • Real-time overview</p>
        </div>
        <button className="glass-interactive" style={{ 
          padding: '10px 20px', 
          background: 'var(--primary)', 
          color: '#0a0e14', 
          border: 'none', 
          fontWeight: '700',
          borderRadius: '10px',
          fontSize: '14px'
        }}>
          <span>ส่งออกรายงาน</span>
          <br/>
          <span style={{ fontSize: '9px', opacity: 0.8 }}>EXPORT REPORT</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <KPICard title={{ thai: 'บทสนทนาทั้งหมด', eng: 'TOTAL CONVERSATIONS' }} value="1,284" icon={MessageSquare} color="#00f2fe" trend="+12.5%" />
        <KPICard title={{ thai: 'ใบงานที่รอดำเนินการ', eng: 'ACTIVE WORK ORDERS' }} value="48" icon={AlertTriangle} color="#ff9f43" trend="-2.4%" />
        <KPICard title={{ thai: 'ปิดใบงานวันนี้', eng: 'RESOLVED TODAY' }} value="156" icon={CheckCircle} color="#28c76f" trend="+8.1%" />
        <KPICard title={{ thai: 'เวลาตอบกลับเฉลี่ย', eng: 'AVG RESPONSE TIME' }} value="1.5m" icon={Clock} color="#7367f0" trend="-15s" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="glass" style={{ padding: '24px', height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px' }}>แนวโน้มใบงาน (WORK ORDER TREND)</h2>
          <div style={{ flex: 1, position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }} className="flex-center">
             <p style={{ color: 'var(--text-muted)' }}>Chart visualization will be here (e.g., SVG/Canvas)</p>
          </div>
        </div>

        <div className="glass" style={{ padding: '24px', height: '400px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px' }}>กิจกรรมล่าสุด (RECENT ACTIVITY)</h2>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ 
                padding: '12px 0', 
                borderBottom: i === 5 ? 'none' : '1px solid var(--border)',
                display: 'flex',
                gap: '12px',
                alignItems: 'start'
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', marginTop: '6px' }} />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600' }}>ใบงาน #TK123{i} เสร็จสมบูรณ์แล้ว!</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>เจ้าหน้าที่ Neo ปิดใบงาน "ปัญหาการเข้าสู่ระบบ" จาก LINE OA</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>2 minutes ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
