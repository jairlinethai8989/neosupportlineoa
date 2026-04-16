'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Download, Loader2, Table as TableIcon, AlignLeft, Filter, Link as LinkIcon 
} from 'lucide-react';
import { exportToExcel } from '@/lib/utils/exportUtils';
import Skeleton from '@/components/ui/Skeleton';

export default function DailyReportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [isExporting, setIsExporting] = useState(false);

  const fetchDailyTickets = async (selectedDate: string) => {
    setLoading(true);
    try {
      const startOfDay = new Date(`${selectedDate}T00:00:00.000Z`).toISOString();
      const endOfDay = new Date(`${selectedDate}T23:59:59.999Z`).toISOString();

      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          customers!tickets_customer_id_fkey (
            display_name,
            hospitals!hospital_id ( name )
          ),
          assigned_agent:profiles!assigned_agent_id( display_name:full_name )
        `)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err: any) {
      console.error('Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyTickets(dateStr);
  }, [dateStr]);

  const getDuration = (start: string, end: string | null) => {
    if (!end) return '-';
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diff = e - s;
    if (diff < 0) return '0 นาที';
    const mins = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    if (hours > 0) return `${hours} ชม. ${m} นาที`;
    return `${m} นาที`;
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    setTimeout(() => {
      const formatData = tickets.map(t => {
        const d = new Date(t.created_at);
        const resolvedAt = t.resolved_at ? new Date(t.resolved_at) : null;
        
        return {
           'สถานะ': t.status === 'Resolved' || t.status === 'Closed' ? '✅' : (t.status === 'New' ? '⚪' : '🔄'),
           'วันที่แจ้ง': d.toLocaleDateString('th-TH'),
           'โรงพยาบาล': t.customers?.hospitals?.name || '-',
           'ผู้แจ้ง': t.customers?.display_name || '-',
           'รายละเอียดงาน': t.subject || t.description || '-',
           'วิธีการแก้ไข': t.resolution_summary || '-',
           'ผู้รับงาน': t.assigned_agent?.display_name || '-',
           'ที่มาของปัญหา': t.source || 'Line กลุ่ม',
           'module': t.module || '-',
           'ประเภทงาน': t.issue_type || '-',
           'เวลาที่แจ้ง': d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
           'เวลาที่ปิดงาน': resolvedAt ? resolvedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-',
           'เวลาที่ใช้ไป': getDuration(t.created_at, t.resolved_at)
        };
      });
      exportToExcel(formatData, `Daily_Issues_${dateStr}`);
      setIsExporting(false);
    }, 500);
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="animate-page-in">
        <Skeleton width={300} height={40} marginBottom={24} />
        <Skeleton width="100%" height={400} borderRadius={16} />
      </div>
    );
  }

  return (
    <div className="animate-page-in" style={{ height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
         <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <div style={{ background: '#e8f5e9', padding: '10px', borderRadius: '12px' }}>
                  <TableIcon size={24} color="#2e7d32" />
               </div>
               <div>
                 <h1 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.5px', color: 'var(--text-main)' }}>รายงานสรุปปัญหาประจำวัน</h1>
                 <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Daily Issues & Resolution Tracker</p>
               </div>
            </div>
         </div>

         <div style={{ display: 'flex', gap: '12px' }}>
            <input 
               type="date" 
               value={dateStr}
               onChange={(e) => setDateStr(e.target.value)}
               className="glass-interactive"
               style={{ padding: '0 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: '700' }}
            />
            <button 
               onClick={() => alert('เชื่อมต่อ Google Sheets สำเร็จ! (Simulation)')}
               className="glass-interactive"
               style={{ height: '44px', padding: '0 16px', borderRadius: '12px', border: '1px solid #1a73e8', background: 'rgba(26,115,232,0.1)', color: '#1a73e8', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
               <LinkIcon size={16} /> Connect G-Sheets
            </button>
            <button 
               onClick={handleExportExcel}
               disabled={isExporting || tickets.length === 0}
               className="glass-interactive"
               style={{ height: '44px', padding: '0 20px', borderRadius: '12px', border: 'none', background: '#2e7d32', color: 'white', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(46,125,50,0.3)' }}
            >
               {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
               EXPORT EXCEL
            </button>
         </div>
      </div>

      {/* Spreadsheet View */}
      <div className="glass" style={{ flex: 1, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
         <div style={{ overflowX: 'auto', overflowY: 'auto', height: '100%', background: 'var(--bg-card)' }}>
            <table style={{ width: '100%', minWidth: '1800px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
               <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#4CAF50', color: 'white', fontWeight: '800' }}>
                  <tr>
                     {[
                       'สถานะ', 'วันที่แจ้ง', 'โรงพยาบาล', 'ผู้แจ้ง', 'รายละเอียดงาน', 
                       'วิธีการแก้ไข', 'ผู้รับงาน', 'ที่มาของปัญหา', 'module', 'ประเภทงาน', 
                       'เวลาที่แจ้ง', 'เวลาที่ปิดงาน', 'เวลาที่ใช้ไป'
                     ].map((col, i) => (
                        <th key={i} style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.2)', whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              {col}
                              <Filter size={12} opacity={0.6} cursor="pointer" />
                           </div>
                        </th>
                     ))}
                  </tr>
               </thead>
               <tbody>
                  {loading && tickets.length === 0 ? (
                     <tr><td colSpan={13} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin text-primary" style={{ margin: '0 auto' }} /></td></tr>
                  ) : tickets.length === 0 ? (
                     <tr><td colSpan={13} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>ไม่พบข้อมูลใบงานในวันที่เลือก</td></tr>
                  ) : (
                     tickets.map((t, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                           <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {t.status === 'Resolved' || t.status === 'Closed' ? '✅' : (t.status === 'New' ? '⚪' : '🔄')}
                           </td>
                           <td style={{ padding: '12px 16px' }}>{new Date(t.created_at).toLocaleDateString('th-TH')}</td>
                           <td style={{ padding: '12px 16px', fontWeight: '700' }}>{t.customers?.hospitals?.name || '-'}</td>
                           <td style={{ padding: '12px 16px' }}>{t.customers?.display_name || '-'}</td>
                           <td style={{ padding: '12px 16px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <AlignLeft size={12} style={{ display: 'inline', marginRight: '6px', opacity: 0.5 }} />
                              {t.subject || t.description || '-'}
                           </td>
                           <td style={{ padding: '12px 16px', color: 'var(--primary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.resolution_summary || '-'}</td>
                           <td style={{ padding: '12px 16px' }}>{t.assigned_agent?.display_name || '-'}</td>
                           <td style={{ padding: '12px 16px', color: '#2e7d32', background: 'rgba(46,125,50,0.05)' }}>{t.source || 'Line กลุ่ม'}</td>
                           <td style={{ padding: '12px 16px', fontWeight: '700' }}>{t.module || '-'}</td>
                           <td style={{ padding: '12px 16px' }}>
                              <span style={{ padding: '4px 8px', background: 'rgba(255,165,0,0.1)', color: 'orange', borderRadius: '4px', fontSize: '10px', fontWeight: '800' }}>
                                 {t.issue_type || t.priority || 'PB'}
                              </span>
                           </td>
                           <td style={{ padding: '12px 16px' }}>{new Date(t.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</td>
                           <td style={{ padding: '12px 16px' }}>{t.resolved_at ? new Date(t.resolved_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '-'}</td>
                           <td style={{ padding: '12px 16px', fontWeight: '700', color: t.resolved_at ? 'var(--success)' : 'inherit' }}>{getDuration(t.created_at, t.resolved_at)}</td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>
         
         <div style={{ padding: '14px 20px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
            <span>กำลังแสดงผล {tickets.length} รายการ</span>
            <span>ข้อมูล Real-time ตามรอบวัน (00:00 - 23:59)</span>
         </div>
      </div>
    </div>
  );
}
