'use client';
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  CheckCircle, 
  Search, 
  User,
  Calendar,
  Loader2
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { ticketService } from '@/lib/services/ticketService';

function TicketsContent() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useNotificationContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Resolve State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingTicket, setResolvingTicket] = useState<any>(null);
  const [resSummary, setResSummary] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedIssueType, setSelectedIssueType] = useState('');
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>([]);
  const [personalResTemplates, setPersonalResTemplates] = useState<string[]>([]);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        customers!tickets_customer_id_fkey (*),
        assigned_agent:profiles!assigned_agent_id(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      addToast({
         id: 'fetch-error',
         type: 'error',
         title: 'Error',
         body: 'ไม่สามารถโหลดข้อมูลใบงานได้'
      });
    } else {
      setTickets(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
     async function loadSettings() {
        const { data: companyData } = await supabase.from('company_settings').select('modules, issue_types').limit(1).single();
        if (companyData) {
           if (companyData.modules) setAvailableModules(companyData.modules);
           if (companyData.issue_types) setAvailableIssueTypes(companyData.issue_types);
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
           const { data: profile } = await supabase.from('profiles').select('resolution_templates').eq('id', user.id).single();
           if (profile?.resolution_templates) setPersonalResTemplates(profile.resolution_templates);
        }
     }
     if (showResolveModal) loadSettings();
  }, [showResolveModal]);

  const handleResolveClick = (ticket: any) => {
    setResolvingTicket(ticket);
    setShowResolveModal(true);
  };

  const handleExecuteResolve = async () => {
     if (!resSummary.trim() || !selectedModule || !selectedIssueType) {
        addToast({
           id: 'validation-error',
           type: 'warning',
           title: 'แจ้งเตือน',
           body: 'กรุณาระบุโมดูล ประเภทงาน และสรุปงานให้ครบถ้วน'
        });
        return;
     }

     setLoading(true);
     try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const success = await ticketService.resolve(
           resolvingTicket.id, 
           user.id, 
           resSummary, 
           selectedModule,
           selectedIssueType
        );
        if (success) {
           addToast({
              id: 'resolve-success',
              type: 'success',
              title: 'ปิดงานสำเร็จ',
              body: `ใบงาน #${resolvingTicket.ticket_no} ถูกปิดงานเรียบร้อยแล้ว`
           });
           setShowResolveModal(false);
           setResSummary('');
           setSelectedModule('');
           setSelectedIssueType('');
           fetchTickets();
        }
     } catch (err) {
        addToast({
           id: 'resolve-error',
           type: 'error',
           title: 'เกิดข้อผิดพลาด',
           body: 'ไม่สามารถปิดงานได้'
        });
     } finally {
        setLoading(false);
     }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchSearch = (t.ticket_no?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.customers?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = statusFilter === 'All' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tickets, searchTerm, statusFilter]);

  const columns = [
    { id: 'Open', label: 'รอดำเนินการ', color: 'var(--primary)' },
    { id: 'In Progress', label: 'กำลังดำเนินการ', color: 'var(--warning)' },
    { id: 'Resolved', label: 'แก้ไขแล้ว', color: 'var(--success)' },
    { id: 'Closed', label: 'ปิดงานแล้ว', color: 'var(--text-muted)' }
  ];

  if (loading && tickets.length === 0) {
    return (
       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
          <Loader2 className="animate-spin" size={40} color="var(--primary)" />
       </div>
    );
  }

  return (
    <div style={{ padding: '32px', minHeight: '100vh', background: 'var(--bg-main)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '8px' }}>กระดานจัดการใบงาน</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>ติดตามและจัดการรายการแจ้งซ่อมทั้งหมดของคุณ</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ 
        display: 'flex', 
        gap: '20px', 
        marginBottom: '32px',
        padding: '20px',
        borderRadius: '24px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="ค้นหา..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', padding: '14px 14px 14px 48px', borderRadius: '14px', 
              background: 'var(--bg-input)', border: '1px solid var(--border)', 
              color: 'var(--text-main)', fontSize: '14px', outline: 'none'
            }}
          />
        </div>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ 
            padding: '14px 24px', borderRadius: '14px', background: 'var(--bg-input)', 
            border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '14px'
          }}
        >
          <option value="All">ทุกสถานะ</option>
          {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      {/* Board */}
      <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '20px' }}>
        {columns.map(col => (
          <div key={col.id} style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', padding: '0 8px' }}>
              {col.label} ({filteredTickets.filter(t => t.status === col.id).length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredTickets.filter(t => t.status === col.id).map(ticket => (
                <div 
                  key={ticket.id} 
                  style={{ 
                    background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', 
                    border: '1px solid var(--border)', cursor: 'pointer'
                  }}
                  onClick={() => window.location.href = `/tickets/${ticket.id}`}
                >
                  <p style={{ fontSize: '11px', fontWeight: '900', color: 'var(--primary)', marginBottom: '8px' }}>#{ticket.ticket_no}</p>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '12px' }}>{ticket.title}</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ticket.customers?.display_name || 'ลูกค้า'}</span>
                     {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleResolveClick(ticket); }}
                          style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: 'none', fontWeight: '800', cursor: 'pointer' }}
                        >ปิดงาน</button>
                     )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Resolution Modal */}
      {showResolveModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', padding: '40px', borderRadius: '32px', border: '1px solid var(--border)' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
               <CheckCircle size={48} color="var(--success)" style={{ marginBottom: '16px' }} />
               <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)' }}>ปิดงานใบงาน #{resolvingTicket?.ticket_no}</h3>
            </div>

            {/* 1. Module */}
            <div style={{ marginBottom: '24px' }}>
               <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>Module ที่เกี่ยวข้อง *</label>
               <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                  <option value="">-- เลือกโมดูล --</option>
                  {availableModules.map(m => <option key={m} value={m}>{m}</option>)}
               </select>
            </div>

            {/* 2. ประเภทงาน */}
            <div style={{ marginBottom: '24px' }}>
               <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>ประเภทงาน *</label>
               <select value={selectedIssueType} onChange={(e) => setSelectedIssueType(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                  <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>
                  {availableIssueTypes.map(it => <option key={it} value={it}>{it}</option>)}
               </select>
            </div>

            {/* 3. เทมเพลต */}
            <div style={{ marginBottom: '24px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>เทมเพลตสรุปงาน</label>
                  <a href="/settings/profile" target="_blank" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>จัดการเทมเพลต</a>
               </div>
               <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {personalResTemplates.map((t, i) => (
                    <button key={i} onClick={() => setResSummary(t)} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px' }}>{t}</button>
                  ))}
               </div>
            </div>

            {/* 4. สรุปผลการแก้ไขงาน */}
            <div style={{ marginBottom: '32px' }}>
               <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>สรุปผลการแก้ไขงาน (RESOLUTION SUMMARY) *</label>
               <textarea value={resSummary} onChange={(e) => setResSummary(e.target.value)} placeholder="ระบุรายละเอียดการแก้ไข..." style={{ width: '100%', height: '120px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', color: 'var(--text-main)', resize: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
               <button onClick={() => setShowResolveModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '14px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: '800', cursor: 'pointer' }}>ยกเลิก</button>
               <button onClick={handleExecuteResolve} disabled={loading || !resSummary.trim() || !selectedModule || !selectedIssueType} style={{ flex: 1.5, padding: '16px', borderRadius: '14px', border: 'none', background: 'var(--success)', color: 'black', fontWeight: '900', cursor: 'pointer' }}>{loading ? 'กำลังส่ง...' : 'ยืนยันปิดงาน'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>กำลังโหลด...</div>}>
      <TicketsContent />
    </Suspense>
  );
}
