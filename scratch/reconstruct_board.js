const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';

const fullContent = `'use client';
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  MoreHorizontal,
  ChevronRight,
  User,
  MessageSquare,
  ArrowRight,
  Calendar,
  Loader2,
  X
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
      .select(\`
        *,
        customers!tickets_customer_id_fkey (*),
        assigned_agent:profiles!assigned_agent_id(*)
      \`)
      .order('created_at', { ascending: false });

    if (error) {
      addToast('error', 'ไม่สามารถโหลดข้อมูลใบงานได้');
    } else {
      setTickets(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Use Effect to load settings
  useEffect(() => {
     async function loadSettings() {
        const { data: companyData } = await supabase.from('company_settings').select('id, modules, issue_types').limit(1).single();
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
     loadSettings();
  }, [showResolveModal]);

  const handleResolveClick = (ticket: any) => {
    setResolvingTicket(ticket);
    setShowResolveModal(true);
  };

  const handleExecuteResolve = async () => {
     if (!resSummary.trim() || !selectedModule || !selectedIssueType) {
        addToast('warning', 'กรุณาระบุโมดูล ประเภทงาน และสรุปงานให้ครบถ้วน');
        return;
     }

     setLoading(true);
     try {
        const success = await ticketService.resolve(
           resolvingTicket.id, 
           resolvingTicket.customer_id, 
           resSummary, 
           selectedModule,
           selectedIssueType
        );
        if (success) {
           addToast('success', 'ปิดงานเรียบร้อยแล้ว');
           setShowResolveModal(false);
           setResSummary('');
           setSelectedModule('');
           setSelectedIssueType('');
           fetchTickets();
        }
     } catch (err) {
        addToast('error', 'เกิดข้อผิดพลาดในการปิดงาน');
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
          <h1 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.5px' }}>กระดานจัดการใบงาน</h1>
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
        border: '1px solid var(--border)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="ค้นหาเลขที่ใบงาน, หัวข้อ หรือลูกค้า..."
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
            border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
          }}
        >
          <option value="All">ทุกสถานะ</option>
          <option value="Open">รอดำเนินการ</option>
          <option value="In Progress">กำลังดำเนินการ</option>
          <option value="Resolved">แก้ไขแล้ว</option>
          <option value="Closed">ปิดงานแล้ว</option>
        </select>
      </div>

      {/* Kanban Board */}
      <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '20px', minHeight: '70vh' }}>
        {columns.map(col => (
          <div key={col.id} style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }}></div>
                <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>{col.label}</h2>
                <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                  {filteredTickets.filter(t => t.status === col.id).length}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredTickets.filter(t => t.status === col.id).map(ticket => (
                <div 
                  key={ticket.id} 
                  style={{ 
                    background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', 
                    border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    cursor: 'pointer', transition: 'transform 0.2s'
                  }}
                  onClick={() => window.location.href = \`/tickets/\${ticket.id}\`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--primary)', letterSpacing: '0.5px' }}>#{ticket.ticket_no}</span>
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '16px', lineHeight: '1.4' }}>{ticket.title}</h3>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                     <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={14} color="var(--text-muted)" />
                     </div>
                     <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{ticket.customers?.display_name || 'ลูกค้าทั่วไป'}</span>
                  </div>

                  <div style={{ pt: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                      <Calendar size={12} />
                      <span style={{ fontSize: '11px' }}>{new Date(ticket.created_at).toLocaleDateString('th-TH')}</span>
                    </div>
                    {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                       <button 
                        onClick={(e) => { e.stopPropagation(); handleResolveClick(ticket); }}
                        style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: 'none', fontWeight: '800', cursor: 'pointer' }}
                       >
                         ปิดงาน
                       </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* RESOLVE MODAL - BOARD VIEW */}
      {showResolveModal && (
          <div style={{
             position: 'fixed',
             inset: 0,
             zIndex: 10000,
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             background: 'rgba(5, 8, 12, 0.85)',
             backdropFilter: 'blur(20px)',
             padding: '20px'
          }}>
             <div className="glass" style={{
                width: '100%',
                maxWidth: '480px',
                padding: '40px',
                borderRadius: '32px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
                animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                maxHeight: '90vh',
                overflowY: 'auto'
             }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                   <div style={{ 
                     width: '64px', 
                     height: '64px', 
                     borderRadius: '20px', 
                     background: 'rgba(0, 255, 127, 0.1)', 
                     color: 'var(--success)', 
                     display: 'inline-flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     marginBottom: '20px'
                   }}>
                      <CheckCircle size={32} />
                   </div>
                   <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '8px' }}>ปิดงานใบงาน #{resolvingTicket?.ticket_no}</h3>
                   <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>กรุณาสรุปผลการแก้ไขปัญหา เพื่อบันทึกเป็นประวัติและแจ้งลูกค้าครับ</p>
                </div>

                 {/* 1. Module */}
                 <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>Module ที่เกี่ยวข้อง <span style={{ color: '#ef4444' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                       <select 
                         value={selectedModule} 
                         onChange={(e) => setSelectedModule(e.target.value)}
                         style={{ 
                            width: '100%', 
                            padding: '14px 40px 14px 16px', 
                            borderRadius: '12px', 
                            background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)', 
                            fontSize: '14px', 
                            fontWeight: '800', 
                            outline: 'none',
                            appearance: 'none',
                            cursor: 'pointer',
                            backgroundImage: \`url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")\`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 16px center',
                            backgroundSize: '16px'
                         }}
                       >
                          <option value="" >-- เลือกโมดูล --</option>
                          {availableModules.map(m => (
                            <option key={m} value={m} >{m}</option>
                          ))}
                       </select>
                    </div>
                 </div>

                 {/* 2. ประเภทงาน */}
                 <div style={{ marginBottom: '32px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>ประเภทงาน <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                       <select
                         value={selectedIssueType}
                         onChange={(e) => setSelectedIssueType(e.target.value)}
                         style={{
                            width: '100%',
                            padding: '14px 40px 14px 16px',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-input)',
                            color: 'var(--text-main)',
                            fontSize: '14px',
                            fontWeight: '700',
                            outline: 'none',
                            appearance: 'none',
                            cursor: 'pointer'
                         }}
                       >
                          <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>
                          {availableIssueTypes.map(it => (
                            <option key={it} value={it}>{it}</option>
                          ))}
                       </select>
                    </div>
                 </div>

                 {/* 3. เทมเพลตสรุปงาน */}
                 <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                       <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>เทมเพลตสรุปงาน</label>
                       <a href="/settings/profile" target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>จัดการเทมเพลต</a>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                       {personalResTemplates.map((t, idx) => (
                          <button
                             key={idx}
                             type="button"
                             onClick={() => setResSummary(t)}
                             style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'rgba(0, 242, 254, 0.08)', fontSize: '13px', color: 'var(--primary)', cursor: 'pointer', transition: 'all 0.2s' }}
                          >{t}</button>
                       ))}
                       {personalResTemplates.length === 0 && (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ยังไม่ได้ตั้งค่าเทมเพลต — <a href="/settings/profile" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>ตั้งค่าที่นี่</a></p>
                       )}
                    </div>
                 </div>

                 {/* 4. สรุปผลการแก้ไขงาน */}
                 <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน (RESOLUTION SUMMARY) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <textarea 
                      value={resSummary}
                      onChange={(e) => setResSummary(e.target.value)}
                      placeholder="ระบุรายละเอียดการแก้ไข เช่น 'แก้ไขส่วนลดให้แล้ว', 'อัปเดตสถานะการจัดส่งสำเร็จ'..."
                      style={{
                         width: '100%',
                         height: '140px',
                         background: 'var(--bg-input)',
                         border: '1px solid var(--border)',
                         borderRadius: '16px',
                         padding: '16px',
                         color: 'var(--text-main)',
                         fontSize: '15px',
                         resize: 'none',
                         outline: 'none',
                         transition: 'all 0.3s'
                      }}
                    />
                 </div>

                 {/* Buttons */}
                 <div style={{ display: 'flex', gap: '16px' }}>
                    <button 
                      onClick={() => setShowResolveModal(false)}
                      style={{ flex: 1, padding: '16px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', fontWeight: '800', cursor: 'pointer' }}
                    >
                       ยกเลิก
                    </button>
                    <button 
                      onClick={handleExecuteResolve}
                      disabled={loading || !resSummary.trim() || !selectedModule || !selectedIssueType}
                      style={{ 
                        flex: 1.5, 
                        padding: '16px', 
                        borderRadius: '14px', 
                        border: 'none', 
                        background: (loading || !resSummary.trim() || !selectedModule || !selectedIssueType) ? 'rgba(16, 185, 129, 0.15)' : 'var(--success)', 
                        color: (loading || !resSummary.trim() || !selectedModule || !selectedIssueType) ? 'var(--text-muted)' : 'black', 
                        fontWeight: '900', 
                        cursor: (loading || !resSummary.trim() || !selectedModule || !selectedIssueType) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                      }}
                    >
                       {loading ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> ยืนยันปิดงาน</>}
                    </button>
                 </div>
              </div>
           </div>
        )}

        <style dangerouslySetInnerHTML={{ __html: \`
          @keyframes scaleIn {
             from { opacity: 0; transform: scale(0.95); }
             to { opacity: 1; transform: scale(1); }
          }
        \`}} />
     </div>
   );
 }

 export default function TicketsPage() {
   return (
     <Suspense fallback={
       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
         <Loader2 className="animate-spin" size={32} color="var(--primary)" />
       </div>
     }>
       <TicketsContent />
     </Suspense>
   );
 }
\`;

fs.writeFileSync(path, fullContent, 'utf8');
console.log('✅ RECONSTRUCTED: tickets/page.tsx');
`;

fs.writeFileSync('scratch/reconstruct_board.js', CodeContent, 'utf8');
