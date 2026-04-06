'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  ArrowRight, 
  Zap, 
  CheckCheck, 
  Ticket,
  User,
  Shield,
  Download,
  Info
} from 'lucide-react';
import { formatSlaStatus } from '@/lib/utils/slaUtils';
import { useRouter } from 'next/navigation';

export default function AuditLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [limit, setLimit] = useState(50);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ticket_logs')
        .select(`
          *,
          performer:profiles!performer_id(full_name, avatar_url),
          target_user:profiles!to_user_id(full_name),
          tickets(ticket_no, subject)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (selectedAgent !== 'all') {
        query = query.eq('performer_id', selectedAgent);
      }
      if (selectedAction !== 'all') {
        query = query.eq('action_type', selectedAction);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAgent, selectedAction, limit]);

  const fetchAgents = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    setAgents(data || []);
  };

  useEffect(() => {
    fetchAgents();
    fetchLogs();
  }, [fetchLogs]);

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'claim': return <Zap size={14} color="#ff9f43" />;
      case 'transfer': return <ArrowRight size={14} color="#7367f0" />;
      case 'resolve': return <CheckCheck size={14} color="#28c76f" />;
      case 'status_change': return <History size={14} color="#00f2fe" />;
      default: return <Info size={14} color="#b4b7bd" />;
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'claim': return 'รับงาน (Claim)';
      case 'transfer': return 'โอนงาน (Transfer)';
      case 'resolve': return 'ปิดงาน (Resolve)';
      case 'status_change': return 'เปลี่ยนสถานะ';
      default: return type;
    }
  };

  // Filter logic for search bar
  const filteredLogs = logs.filter(log => {
    const ticketNo = log.tickets?.ticket_no?.toLowerCase() || '';
    const subject = log.tickets?.subject?.toLowerCase() || '';
    const performer = log.performer?.full_name?.toLowerCase() || '';
    const s = searchTerm.toLowerCase();
    return ticketNo.includes(s) || subject.includes(s) || performer.includes(s);
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="audit-container" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(115, 103, 240, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield color="#7367f0" size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800' }}>บันทึกประวัติการทำงาน (Audit Logs)</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginLeft: '50px' }}>ตรวจสอบและติดตามกิจกรรมทั้งหมดที่เกิดขึ้นในระบบ</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
             <button className="glass-interactive" style={{ padding: '10px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', border: '1px solid rgba(0, 242, 254, 0.3)', background: 'rgba(0, 242, 254, 0.05)', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>
               <Download size={16} />
               ส่งออกรายงาน
             </button>
        </div>
      </header>

      {/* Filters Section */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
         <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
            <input 
              type="text" 
              placeholder="ค้นหา Ticket #, ชื่อพนักงาน หรือเหตุการณ์..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px 12px 48px', color: 'white', fontSize: '14px' }}
            />
         </div>

         <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <User size={16} color="var(--text-muted)" />
               <select 
                 value={selectedAgent}
                 onChange={(e) => setSelectedAgent(e.target.value)}
                 style={{ background: 'rgba(10, 14, 20, 0.8)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '13px' }}
               >
                 <option value="all">พนักงานทั้งหมด</option>
                 {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
               </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Filter size={16} color="var(--text-muted)" />
               <select 
                 value={selectedAction}
                 onChange={(e) => setSelectedAction(e.target.value)}
                 style={{ background: 'rgba(10, 14, 20, 0.8)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '13px' }}
               >
                 <option value="all">ทุกกิจกรรม</option>
                 <option value="claim">รับงาน (Claim)</option>
                 <option value="status_change">เปลี่ยนสถานะ</option>
                 <option value="transfer">โอนงาน (Transfer)</option>
                 <option value="resolve">ปิดงาน (Resolve)</option>
               </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <History size={16} color="var(--text-muted)" />
               <select 
                 value={limit}
                 onChange={(e) => setLimit(Number(e.target.value))}
                 style={{ background: 'rgba(10, 14, 20, 0.8)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '13px' }}
               >
                 <option value={50}>50 รายการล่าสุด</option>
                 <option value={100}>100 รายการล่าสุด</option>
                 <option value={200}>200 รายการล่าสุด</option>
               </select>
            </div>
         </div>
      </div>

      {/* Audit Table */}
      <div className="glass-card" style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>วันเวลา</th>
              <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>พนักงาน (Performer)</th>
              <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>เลขใบงาน</th>
              <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>การกระทำ</th>
              <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>รายละเอียด / หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '60px', textAlign: 'center' }}>
                  <div className="loader" style={{ margin: '0 auto 16px' }}></div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>กำลังดึงข้อมูลประวัติ...</p>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '60px', textAlign: 'center' }}>
                  <History size={40} style={{ margin: '0 auto 16px', opacity: 0.1 }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>ไม่พบข้อมูลประวัติในหมวดหมู่ที่เลือก</p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr 
                  key={log.id} 
                  className="table-row-hover"
                  onClick={() => router.push(`/tickets/${log.ticket_id}`)}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700' }}>{formatDate(log.created_at)}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ID: {log.id.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {log.performer?.avatar_url ? (
                        <img src={log.performer.avatar_url} style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800' }}>
                          {log.performer?.full_name?.charAt(0) || 'A'}
                        </div>
                      )}
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>{log.performer?.full_name || 'System'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)' }}>#{log.tickets?.ticket_no || 'N/A'}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.tickets?.subject}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', width: 'fit-content' }}>
                      {getActionIcon(log.action_type)}
                      <span style={{ fontSize: '12px', fontWeight: '700' }}>{getActionLabel(log.action_type)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {log.action_type === 'status_change' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', opacity: 0.6 }}>{log.from_status}</span>
                          <ArrowRight size={10} opacity={0.5} />
                          <span style={{ padding: '2px 6px', background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '4px', fontWeight: '800' }}>{log.to_status}</span>
                        </div>
                      )}
                      {log.action_type === 'transfer' && log.target_user && (
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)' }}>โอนให้: {log.target_user.full_name}</span>
                      )}
                      <span style={{ fontStyle: 'italic', opacity: 0.8 }}>{log.note || '-'}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .table-row-hover:hover {
          background: rgba(255, 255, 255, 0.03) !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .loader {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(0, 242, 254, 0.1);
          border-top: 3px solid var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
