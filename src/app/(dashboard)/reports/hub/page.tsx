'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, 
  Eye, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  ChevronRight,
  ShieldCheck,
  Zap,
  BarChart2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(DateTime.now().toFormat('yyyy-MM-dd'));
  const [tickets, setTickets] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Fetch Session & Permissions
  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserProfile(data);
      }
    }
    getProfile();
  }, []);

  const canSend = useMemo(() => {
    if (userProfile?.role === 'Administrator') return true;
    return userProfile?.permissions?.reports === 'edit';
  }, [userProfile]);

  // Fetch preview data
  const fetchPreview = async () => {
    setLoading(true);
    try {
      const dt = DateTime.fromISO(targetDate);
      const start = dt.startOf('day').toISODate();
      const end = dt.endOf('day').toISO();

      // Get tickets created today
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('*, hospitals(name)')
        .gte('created_at', start + 'T00:00:00Z')
        .lte('created_at', end || '')
        .order('created_at', { ascending: false });

      // Identify resolved tickets in this window too
      const { data: resolvedData } = await supabase
        .from('tickets')
        .select('*, hospitals(name)')
        .gte('resolved_at', start + 'T00:00:00Z')
        .lte('resolved_at', end || '');

      // Merge unique
      const allIds = new Set(ticketData?.map(t => t.id));
      const merged = [...(ticketData || [])];
      resolvedData?.forEach(t => {
        if (!allIds.has(t.id)) merged.push(t);
      });

      setTickets(merged);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [targetDate]);

  // Grouping for preview
  const groupedData = useMemo(() => {
    const stats = {
      total: tickets.length,
      newProgress: tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length,
      resolved: tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length,
      hospitalGroups: {} as Record<string, number>
    };

    tickets.forEach(t => {
      const hName = t.hospitals?.name || 'ไม่ระบุโรงพยาบาล';
      stats.hospitalGroups[hName] = (stats.hospitalGroups[hName] || 0) + 1;
    });

    return stats;
  }, [tickets]);

  const handleSendReport = async (set: string) => {
    const reportName = set === '1' ? 'สรุปยอดรายวัน (KPI)' : 'รายละเอียดงานแยกโรงพยาบาล (Detailed)';
    
    if (!window.confirm(`⚠️ ยืนยันการส่งรายงาน: ${reportName} เข้ากลุ่ม LINE หรือไม่?`)) return;

    setSending(set);
    try {
      const res = await fetch(`/api/cron/daily-summary?key=NEO_CRON_2026&set=${set}&date=${targetDate}`);
      const data = await res.json();
      if (data.success) {
        alert(`✅ ส่งรายงาน "${reportName}" สำเร็จ!`);
      } else {
        alert(`❌ ส่งไม่สำเร็จ: ${data.error || 'Unknown Error'}`);
      }
    } catch (e) {
      alert('❌ เกิดข้อผิดพลาดทางเทคนิคในการส่ง');
    } finally {
      setSending(null);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out', maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
             <ShieldCheck color="var(--primary)" size={32} />
             ศูนย์ควบคุมการส่งรายงาน
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
             LINE REPORTING HUB • PREVIEW & BROADCAST
          </p>
        </div>
        
        <div className="glass" style={{ padding: '8px 16px', borderRadius: '14px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Calendar size={18} color="var(--primary)" />
          <input 
            type="date" 
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--text-main)', 
              fontSize: '14px', fontWeight: '700', outline: 'none', cursor: 'pointer' 
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '24px' }}>
        {/* Left Column: Preview Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Summary Stats Card */}
          <div className="glass-premium" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
               <BarChart2 size={120} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Eye size={18} color="var(--primary)" />
               ตรวจสอบข้อมูล: {DateTime.fromISO(targetDate).setLocale('th').toFormat('dd MMMM yyyy')}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
               <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>รวมทั้งหมด</p>
                  <p style={{ fontSize: '24px', fontWeight: '900' }}>{loading ? '...' : groupedData.total}</p>
               </div>
               <div style={{ background: 'rgba(0, 242, 254, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid var(--primary)' }}>
                  <p style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase' }}>งานคงค้าง/ใหม่</p>
                  <p style={{ fontSize: '24px', fontWeight: '900', color: 'var(--primary)' }}>{loading ? '...' : groupedData.newProgress}</p>
               </div>
               <div style={{ background: 'rgba(40, 199, 111, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid var(--success)' }}>
                  <p style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '700', textTransform: 'uppercase' }}>ปิดงานได้</p>
                  <p style={{ fontSize: '24px', fontWeight: '900', color: 'var(--success)' }}>{loading ? '...' : groupedData.resolved}</p>
               </div>
            </div>
          </div>

          {/* Detailed Hospital Grouping Preview */}
          <div className="glass" style={{ padding: '24px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
               <h3 style={{ fontSize: '14px', fontWeight: '800' }}>การจัดกลุ่มแยกโรงพยาบาล (ที่จะถูกส่ง)</h3>
               {loading && <Zap size={16} className="animate-pulse" color="var(--primary)" />}
             </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(groupedData.hospitalGroups).length === 0 && !loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                     <Zap size={32} style={{ opacity: 0.1, marginBottom: '12px' }} />
                     <p>ไม่พบข้อมูลตั๋วงานในวันที่เลือก</p>
                  </div>
                ) : Object.entries(groupedData.hospitalGroups).map(([name, count]) => (
                   <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{name}</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', background: 'var(--primary)', color: 'black', padding: '2px 10px', borderRadius: '20px' }}>
                        {count} งาน
                      </span>
                   </div>
                ))}
             </div>
          </div>
        </div>

        {/* Right Column: Control Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-premium" style={{ padding: '24px', border: '1px solid #FBC02D' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <FileText color="#FBC02D" size={24} />
                <h4 style={{ fontWeight: '800', fontSize: '15px' }}>REPORT SET 1</h4>
             </div>
             <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                ส่งรายงานสรุปยอด KPI (สีเหลืองทอง) เหมาะสมสำหรับการสรุปผลงานระดับบริหารในแต่ละวัน
             </p>
             <button 
                disabled={sending !== null || groupedData.total === 0 || loading || !canSend}
                onClick={() => handleSendReport('1')}
                className="glass-interactive"
                style={{ 
                  width: '100%', padding: '14px', borderRadius: '12px', 
                  background: !canSend ? 'rgba(255,255,255,0.05)' : (sending === '1' ? 'var(--bg-card)' : '#FBC02D'), 
                  color: !canSend ? 'var(--text-muted)' : 'black', fontWeight: '900', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  opacity: (groupedData.total === 0 || loading) ? 0.5 : 1
                }}
             >
                {sending === '1' ? 'กำลังส่ง...' : (!canSend ? '🔒 เฉพาะผู้ได้รับสิทธิ์' : <><Send size={18} /> ส่งรายงานสรุป KPI</>)}
             </button>
          </div>

          <div className="glass-premium" style={{ padding: '24px', border: '1px solid var(--primary)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Send color="var(--primary)" size={24} />
                <h4 style={{ fontWeight: '800', fontSize: '15px' }}>REPORT SET 2</h4>
             </div>
             <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                ส่งรายละเอียดงานแยกตามโรงพยาบาล (Mission Logs) เพื่อให้ทีมงานสามารถตรวจสอบได้ครบถ้วน
             </p>
             <button 
                disabled={sending !== null || groupedData.total === 0 || loading || !canSend}
                onClick={() => handleSendReport('2')}
                className="glass-interactive"
                style={{ 
                  width: '100%', padding: '14px', borderRadius: '12px', 
                  background: !canSend ? 'rgba(255,255,255,0.05)' : (sending === '2' ? 'var(--bg-card)' : 'var(--primary)'), 
                  color: !canSend ? 'var(--text-muted)' : 'black', fontWeight: '900', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  opacity: (groupedData.total === 0 || loading) ? 0.5 : 1
                }}
             >
                {sending === '2' ? 'กำลังส่ง...' : (!canSend ? '🔒 เฉพาะผู้ได้รับสิทธิ์' : <><ChevronRight size={18} /> ส่งรายละเอียดงาน</>)}
             </button>
          </div>

          <div style={{ padding: '16px', background: 'rgba(234, 84, 85, 0.05)', borderRadius: '12px', border: '1px solid rgba(234, 84, 85, 0.1)', display: 'flex', gap: '12px' }}>
             <AlertCircle size={20} color="var(--danger)" style={{ flexShrink: 0 }} />
             <p style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '600' }}>
               ระมัดระวัง: การกดปุ่ม "ยืนยัน" จะส่งรายงานไปยังกลุ่ม LINE ทันที กรุณาตรวจสอบวันที่และจำนวนงานจาก Preview ให้ถูกต้อง
             </p>
          </div>

          {groupedData.total > 0 && !loading && (
             <div style={{ textAlign: 'center', padding: '10px' }}>
                <p style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                   <CheckCircle2 size={14} /> ข้อมูลวันที่นี้พร้อมสำหรับส่งแล้ว
                </p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
