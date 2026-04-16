'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Download, Loader2, Table as TableIcon, AlignLeft, Filter, Link as LinkIcon,
  ArrowUpDown, Search, X
} from 'lucide-react';
import { exportToExcel } from '@/lib/utils/exportUtils';
import Skeleton from '@/components/ui/Skeleton';

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export default function DailyReportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [isExporting, setIsExporting] = useState(false);
  
  // Sorting & Filtering State
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [filterText, setFilterText] = useState('');
  const [showFilter, setShowFilter] = useState(false);

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

  const getDurationMs = (start: string, end: string | null) => {
    if (!end) return 0;
    return new Date(end).getTime() - new Date(start).getTime();
  };

  const getDurationStr = (start: string, end: string | null) => {
    const diff = getDurationMs(start, end);
    if (!end || diff <= 0) return '-';
    const mins = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    if (hours > 0) return `${hours} ชม. ${m} นาที`;
    return `${m} นาที`;
  };

  // Process data (Filter & Sort)
  const processedTickets = useMemo(() => {
    let result = [...tickets];

    // Filter
    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter(t => 
        (t.subject?.toLowerCase().includes(lower)) ||
        (t.description?.toLowerCase().includes(lower)) ||
        (t.customers?.display_name?.toLowerCase().includes(lower)) ||
        (t.customers?.hospitals?.name?.toLowerCase().includes(lower)) ||
        (t.assigned_agent?.display_name?.toLowerCase().includes(lower)) ||
        (t.status?.toLowerCase().includes(lower)) ||
        (t.module?.toLowerCase().includes(lower))
      );
    }

    // Sort
    if (sortConfig) {
      result.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        switch (sortConfig.key) {
          case 'status': valA = a.status; valB = b.status; break;
          case 'date': valA = a.created_at; valB = b.created_at; break;
          case 'hospital': valA = a.customers?.hospitals?.name; valB = b.customers?.hospitals?.name; break;
          case 'customer': valA = a.customers?.display_name; valB = b.customers?.display_name; break;
          case 'subject': valA = a.subject || a.description; valB = b.subject || b.description; break;
          case 'resolution': valA = a.resolution_summary; valB = b.resolution_summary; break;
          case 'agent': valA = a.assigned_agent?.display_name; valB = b.assigned_agent?.display_name; break;
          case 'source': valA = a.source; valB = b.source; break;
          case 'module': valA = a.module; valB = b.module; break;
          case 'type': valA = a.issue_type; valB = b.issue_type; break;
          case 'resolved_at': valA = a.resolved_at || ''; valB = b.resolved_at || ''; break;
          case 'duration': valA = getDurationMs(a.created_at, a.resolved_at); valB = getDurationMs(b.created_at, b.resolved_at); break;
          default: valA = a.created_at; valB = b.created_at;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tickets, filterText, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    setTimeout(() => {
      const formatData = processedTickets.map(t => {
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
           'เวลาที่ใช้ไป': getDurationStr(t.created_at, t.resolved_at)
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

  const COLUMNS = [
    { label: 'สถานะ', key: 'status' },
    { label: 'วันที่แจ้ง', key: 'date' },
    { label: 'โรงพยาบาล', key: 'hospital' },
    { label: 'ผู้แจ้ง', key: 'customer' },
    { label: 'รายละเอียดงาน', key: 'subject' },
    { label: 'วิธีการแก้ไข', key: 'resolution' },
    { label: 'ผู้รับงาน', key: 'agent' },
    { label: 'ที่มาของปัญหา', key: 'source' },
    { label: 'module', key: 'module' },
    { label: 'ประเภทงาน', key: 'type' },
    { label: 'เวลาที่แจ้ง', key: 'date' },
    { label: 'เวลาที่ปิดงาน', key: 'resolved_at' },
    { label: 'เวลาที่ใช้ไป', key: 'duration' },
  ];

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
            {showFilter && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  placeholder="ค้นหาข้อมูลในตาราง..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="glass-interactive"
                  autoFocus
                  style={{ padding: '0 36px', width: '250px', height: '44px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                />
                {filterText && (
                  <button onClick={() => setFilterText('')} style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            <button 
              onClick={() => setShowFilter(!showFilter)}
              className={`glass-interactive ${showFilter ? 'active' : ''}`}
              style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: showFilter ? '1px solid var(--primary)' : '1px solid var(--border)', background: showFilter ? 'var(--primary-transparent)' : 'var(--bg-card)', color: showFilter ? 'var(--primary)' : 'var(--text-main)' }}
            >
              <Filter size={18} />
            </button>

            <input 
               type="date" 
               value={dateStr}
               onChange={(e) => setDateStr(e.target.value)}
               className="glass-interactive"
               style={{ padding: '0 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: '700' }}
            />
            
            <button 
               onClick={handleExportExcel}
               disabled={isExporting || processedTickets.length === 0}
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
                     {COLUMNS.map((col, i) => (
                        <th 
                          key={i} 
                          onClick={() => handleSort(col.key)}
                          style={{ 
                            padding: '12px 16px', 
                            borderRight: '1px solid rgba(255,255,255,0.2)', 
                            whiteSpace: 'nowrap', 
                            textTransform: 'uppercase', 
                            fontSize: '11px', 
                            letterSpacing: '0.5px',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                        >
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              {col.label}
                              <div style={{ display: 'flex', flexDirection: 'column', opacity: sortConfig?.key === col.key ? 1 : 0.3 }}>
                                <ArrowUpDown size={12} />
                              </div>
                           </div>
                        </th>
                     ))}
                  </tr>
               </thead>
               <tbody>
                  {loading && tickets.length === 0 ? (
                     <tr><td colSpan={13} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin text-primary" style={{ margin: '0 auto' }} /></td></tr>
                  ) : processedTickets.length === 0 ? (
                     <tr><td colSpan={13} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        {filterText ? 'ไม่พบข้อมูลที่ตรงกับการค้นหา' : 'ไม่พบข้อมูลใบงานในวันที่เลือก'}
                     </td></tr>
                  ) : (
                     processedTickets.map((t, idx) => (
                        <tr key={t.id || idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
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
                           <td style={{ padding: '12px 16px', fontWeight: '700', color: t.resolved_at ? 'var(--success)' : 'inherit' }}>{getDurationStr(t.created_at, t.resolved_at)}</td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>
         
         <div style={{ padding: '14px 20px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
            <span>กำลังแสดงผล {processedTickets.length} รายการ {filterText && `(จากทั้งหมด ${tickets.length} รายการ)`}</span>
            <span>ข้อมูล Real-time ตามรอบวัน (00:00 - 23:59)</span>
         </div>
      </div>
    </div>
  );
}
 Broadway Broadway  
