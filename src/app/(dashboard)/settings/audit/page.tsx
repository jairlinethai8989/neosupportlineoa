'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  History, 
  Search, 
  ArrowRight, 
  Zap, 
  Loader2,
  CheckCheck, 
  Ticket,
  User,
  Users,
  Shield,
  Info,
  Clock,
  Activity,
  FileSpreadsheet,
  FileText,
  Trash2,
  Lock,
  Plus,
  Edit3,
  MessageSquarePlus,
  Mail,
  X,
  ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { auditService } from '@/lib/services/auditService';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { translateAuditAction, translateTicketStatus } from '@/lib/i18n/staff';
import { clearSystemLogsAction, clearTicketLogsAction } from '@/app/actions/auditActions';
import { useNotificationContext } from '@/contexts/NotificationContext';

// Export utils (loaded dynamically to keep page bundle size small)

export default function AuditLogPage() {
  const { t, locale } = useStaffLocale();
  const { userProfile } = useAppContext();
  const { addToast } = useNotificationContext();
  const router = useRouter();

  const canEdit = React.useMemo(() => {
    if (userProfile?.role === 'Administrator') return true;
    return userProfile?.permissions?.settings_audit === 'edit';
  }, [userProfile]);
  const [activeTab, setActiveTab] = useState<'ticket' | 'system'>('ticket');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [limit, setLimit] = useState(50);
  const [clearing, setClearing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Calculate summary stats for the dashboard view
  const stats = React.useMemo(() => {
    const total = logs.length;
    const uniquePerformers = new Set(logs.map(l => l.performer_id).filter(Boolean)).size;
    const criticalActions = logs.filter(l => 
      ['staff_delete', 'staff_permission_update', 'master_delete', 'branding_update', 'sla_update'].includes(l.action_type?.toLowerCase())
    ).length;
    
    return { total, uniquePerformers, criticalActions };
  }, [logs]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'ticket') {
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

        if (selectedAgent !== 'all') query = query.eq('performer_id', selectedAgent);
        if (selectedAction !== 'all') query = query.eq('action_type', selectedAction);

        const { data, error } = await query;
        if (error) throw error;
        setLogs(data || []);
      } else {
        const { data, error } = await auditService.getSystemLogs({
          agentId: selectedAgent,
          actionType: selectedAction,
          limit: limit
        });
        if (error) throw error;
        setLogs(data || []);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedAgent, selectedAction, limit]);

  const fetchAgents = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    setAgents(data || []);
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchLogs();
  }, [fetchLogs, fetchAgents]);

  // Reset filters when switching tabs
  useEffect(() => {
    setSelectedAction('all');
    setSearchTerm('');
  }, [activeTab]);

  const getActionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'claim': return <Zap size={14} color="#ff9f43" />;
      case 'transfer': return <ArrowRight size={14} color="#7367f0" />;
      case 'resolve': return <CheckCheck size={14} color="#28c76f" />;
      case 'status_change': return <History size={14} color="#00f2fe" />;
      case 'staff_create': return <User size={14} color="#7367f0" />;
      case 'staff_delete': return <Trash2 size={14} color="#ea5455" />;
      case 'staff_permission_update': return <Lock size={14} color="#7367f0" />;
      case 'branding_update': return <Activity size={14} color="#ffcd3c" />;
      case 'dept_create': return <Shield size={14} color="#00f2fe" />;
      case 'sla_update': return <Clock size={14} color="#ff9f43" />;
      case 'master_create': return <Plus size={14} color="#28c76f" />;
      case 'master_update': return <Edit3 size={14} color="#7367f0" />;
      case 'master_delete': return <Trash2 size={14} color="#ea5455" />;
      case 'master_toggle': return <Activity size={14} color="#ff9f43" />;
      case 'profile_update': return <User size={14} color="#7367f0" />;
      case 'template_add': return <MessageSquarePlus size={14} color="#28c76f" />;
      case 'template_delete': return <Trash2 size={14} color="#ea5455" />;
      case 'reopen': return <ArrowRight size={14} color="#00f2fe" />;
      case 'note': return <FileText size={14} color="#ffcd3c" />;
      case 'message': return <Mail size={14} color="#7367f0" />;
      default: return <Info size={14} color="#b4b7bd" />;
    }
  };

  const getActionLabel = (type: string) => {
    return translateAuditAction(type, locale);
  };

  const filteredLogs = logs.filter(log => {
    const s = searchTerm.toLowerCase();
    if (activeTab === 'ticket') {
      const ticketNo = log.tickets?.ticket_no?.toLowerCase() || '';
      const subject = log.tickets?.subject?.toLowerCase() || '';
      const performer = log.performer?.full_name?.toLowerCase() || '';
      return ticketNo.includes(s) || subject.includes(s) || performer.includes(s);
    } else {
      const action = log.action_type?.toLowerCase() || '';
      const note = log.note?.toLowerCase() || '';
      const performer = log.performer?.full_name?.toLowerCase() || '';
      return action.includes(s) || note.includes(s) || performer.includes(s);
    }
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(locale === 'th' ? 'th-TH' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExportExcel = async () => {
    const dataToExport = filteredLogs.map(log => ({
      [t('settingsAudit.headers.time')]: formatDate(log.created_at),
      [t('settingsAudit.headers.actor')]: log.performer?.full_name || t('settingsAudit.systemFallback'),
      [t('settingsAudit.headers.action')]: getActionLabel(log.action_type),
       ...(activeTab === 'ticket' ? {
         [t('settingsAudit.headers.ticket')]: log.tickets?.ticket_no || 'N/A',
         [t('settingsAudit.headers.details')]: log.tickets?.subject || ''
       } : {
         [t('settingsAudit.headers.details')]: log.note || ''
       })
    }));

    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs');
      XLSX.writeFile(wb, `${t('settingsAudit.messages.exportPrefix')}_${activeTab}_${new Date().getTime()}.xlsx`);
    } catch (err) {
      console.error('Audit Log Excel Export Error:', err);
      addToast({
        id: `audit-excel-err-${Date.now()}`,
        type: 'ticket',
        title: t('settingsAudit.error') || 'Error',
        body: 'Failed to load Excel export module',
      });
    }
  };

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      
      const doc = new jsPDF() as any;
      const title = activeTab === 'ticket' ? t('settingsAudit.ticketTab') : t('settingsAudit.systemTab');
      doc.text(title, 14, 15);
      
      const tableData = filteredLogs.map(log => [
        formatDate(log.created_at),
        log.performer?.full_name || t('settingsAudit.systemFallback'),
        getActionLabel(log.action_type),
        activeTab === 'ticket' ? (log.tickets?.ticket_no || 'N/A') : log.note || ''
      ]);

      doc.autoTable({
        head: [[t('settingsAudit.headers.time'), t('settingsAudit.headers.actor'), t('settingsAudit.headers.action'), activeTab === 'ticket' ? t('settingsAudit.headers.ticket') : t('settingsAudit.headers.details')]],
        body: tableData,
        startY: 20,
      });
      
      doc.save(`${t('settingsAudit.messages.exportPrefix')}_${activeTab}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF:', err);
    }
  };

  const handleClearLogs = async () => {
    if (!userProfile || userProfile.role !== 'Administrator') {
      alert(t('settingsAudit.messages.adminOnly'));
      return;
    }

    if (!confirm(t('settingsAudit.messages.clearConfirm'))) return;

    setClearing(true);
    try {
      const result = activeTab === 'ticket' 
        ? await clearTicketLogsAction() 
        : await clearSystemLogsAction();

      if (result.success) {
        addToast({
          id: `clear-log-${Date.now()}`,
          type: 'ticket',
          title: t('settingsAudit.messages.clearSuccessTitle'),
          body: t('settingsAudit.messages.clearSuccessBody')
        });
        fetchLogs();
      } else {
        alert(result.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="audit-page" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
             <div className="glass" style={{ padding: '12px', borderRadius: '14px', background: 'var(--primary-glow)' }}>
                <Shield color="var(--primary)" size={24} />
             </div>
             <div>
                <h1 style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-0.5px' }}>{t('settingsAudit.title')}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500' }}>{t('settingsAudit.subtitle')}</p>
             </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
           {userProfile?.role === 'Administrator' && (
             <button 
               onClick={handleClearLogs} 
               disabled={clearing}
               className="glass-interactive" 
               style={{ padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(234, 84, 85, 0.1)', color: '#ea5455', border: '1px solid rgba(234, 84, 85, 0.2)', cursor: clearing ? 'not-allowed' : 'pointer', fontWeight: '800', fontSize: '13px' }}
             >
               {clearing ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
               {t('settingsAudit.clearLogs')}
             </button>
           )}
           <button 
             onClick={handleExportExcel} 
             disabled={!canEdit}
             className="glass-interactive" 
             style={{ padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(40, 199, 111, 0.1)', color: '#28c76f', border: '1px solid rgba(40, 199, 111, 0.2)', cursor: !canEdit ? 'not-allowed' : 'pointer', fontWeight: '800', fontSize: '13px', opacity: !canEdit ? 0.5 : 1 }}
           >
             <FileSpreadsheet size={18} />
             {t('settingsAudit.exportExcel')}
           </button>
           <button 
             onClick={handleExportPDF} 
             disabled={!canEdit}
             className="glass-interactive" 
             style={{ padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(234, 84, 85, 0.1)', color: '#ea5455', border: '1px solid rgba(234, 84, 85, 0.2)', cursor: !canEdit ? 'not-allowed' : 'pointer', fontWeight: '800', fontSize: '13px', opacity: !canEdit ? 0.5 : 1 }}
           >
             <FileText size={18} />
             {t('settingsAudit.exportPdf')}
           </button>
        </div>
      </div>

      {/* Summary Dashboard Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
         <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid var(--border)' }}>
            <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '14px', borderRadius: '16px' }}>
               <Activity size={24} color="var(--primary)" />
            </div>
            <div>
               <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Events</p>
               <h3 style={{ fontSize: '24px', fontWeight: '900' }}>{stats.total} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>logs</span></h3>
            </div>
         </div>
         <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid var(--border)' }}>
            <div style={{ background: 'rgba(115, 103, 240, 0.1)', padding: '14px', borderRadius: '16px' }}>
               <Users size={24} color="#7367f0" />
            </div>
            <div>
               <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Active Staff</p>
               <h3 style={{ fontSize: '24px', fontWeight: '900' }}>{stats.uniquePerformers} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>actors</span></h3>
            </div>
         </div>
         <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid var(--border)' }}>
            <div style={{ background: 'rgba(234, 84, 85, 0.1)', padding: '14px', borderRadius: '16px' }}>
               <Shield size={24} color="#ea5455" />
            </div>
            <div>
               <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Critical Actions</p>
               <h3 style={{ fontSize: '24px', fontWeight: '900' }}>{stats.criticalActions} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>security</span></h3>
            </div>
         </div>
      </div>

      {/* Custom Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '14px', border: '1px solid var(--border)', marginBottom: '24px', width: 'fit-content' }}>
         <button 
           onClick={() => setActiveTab('ticket')}
           style={{ 
             padding: '10px 24px', borderRadius: '10px', border: 'none', 
             background: activeTab === 'ticket' ? 'var(--primary)' : 'transparent',
             color: activeTab === 'ticket' ? '#0a0e14' : 'var(--text-muted)',
             fontWeight: '800', fontSize: '14px', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
             display: 'flex', alignItems: 'center', gap: '8px'
           }}>
           <Ticket size={16} />
           {t('settingsAudit.ticketTab')}
         </button>
         <button 
           onClick={() => setActiveTab('system')}
           style={{ 
             padding: '10px 24px', borderRadius: '10px', border: 'none', 
             background: activeTab === 'system' ? 'var(--primary)' : 'transparent',
             color: activeTab === 'system' ? '#0a0e14' : 'var(--text-muted)',
             fontWeight: '800', fontSize: '14px', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
             display: 'flex', alignItems: 'center', gap: '8px'
           }}>
           <Activity size={16} />
           {t('settingsAudit.systemTab')}
         </button>
      </div>

      {/* Filter Grid */}
      <div className="glass" style={{ padding: '24px', borderRadius: '20px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '20px', alignItems: 'center' }}>
         <div style={{ position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
            <input 
              type="text" 
              placeholder={activeTab === 'ticket' ? t('settingsAudit.ticketSearchPlaceholder') : t('settingsAudit.systemSearchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px 16px 14px 52px', color: 'var(--text-main)', fontSize: '15px' }}
            />
         </div>

         <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
               <User size={16} color="var(--primary)" opacity={0.6} />
               <select 
                 value={selectedAgent}
                 onChange={(e) => setSelectedAgent(e.target.value)}
                 style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '14px', padding: '8px 0', outline: 'none', cursor: 'pointer', fontWeight: '600' }}
               >
                 <option value="all" style={{ background: 'var(--bg-deep)' }}>{t('settingsAudit.allAgents')}</option>
                 {agents.map(a => <option key={a.id} value={a.id} style={{ background: 'var(--bg-deep)' }}>{a.full_name}</option>)}
               </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
               <Activity size={16} color="var(--primary)" opacity={0.6} />
               <select 
                 value={selectedAction}
                 onChange={(e) => setSelectedAction(e.target.value)}
                 style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '14px', padding: '8px 0', outline: 'none', cursor: 'pointer', fontWeight: '600' }}
               >
                 <option value="all" style={{ background: 'var(--bg-deep)' }}>{t('settingsAudit.headers.action')}: {t('dashboard.tabs.all')}</option>
                 {activeTab === 'ticket' ? (
                   <>
                     <option value="claim" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('claim', locale)}</option>
                     <option value="transfer" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('transfer', locale)}</option>
                     <option value="resolve" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('resolve', locale)}</option>
                     <option value="status_change" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('status_change', locale)}</option>
                     <option value="reopen" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('reopen', locale)}</option>
                     <option value="note" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('note', locale)}</option>
                     <option value="message" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('message', locale)}</option>
                   </>
                 ) : (
                   <>
                     <option value="STAFF_CREATE" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('staff_create', locale)}</option>
                     <option value="STAFF_DELETE" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('staff_delete', locale)}</option>
                     <option value="STAFF_PERMISSION_UPDATE" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('staff_permission_update', locale)}</option>
                     <option value="BRANDING_UPDATE" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('branding_update', locale)}</option>
                     <option value="SLA_UPDATE" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('sla_update', locale)}</option>
                     <option value="MASTER_CREATE" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('master_create', locale)}</option>
                     <option value="MASTER_UPDATE" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('master_update', locale)}</option>
                     <option value="MASTER_DELETE" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('master_delete', locale)}</option>
                     <option value="MASTER_TOGGLE" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('master_toggle', locale)}</option>
                     <option value="PROFILE_UPDATE" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('profile_update', locale)}</option>
                     <option value="TEMPLATE_ADD" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('template_add', locale)}</option>
                     <option value="TEMPLATE_DELETE" style={{ background: 'var(--bg-deep)' }}>{translateAuditAction('template_delete', locale)}</option>
                   </>
                 )}
               </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
               <Clock size={16} color="var(--primary)" opacity={0.6} />
               <select 
                 value={limit}
                 onChange={(e) => setLimit(Number(e.target.value))}
                 style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '14px', padding: '8px 0', outline: 'none', cursor: 'pointer', fontWeight: '600' }}
               >
                 <option value={50} style={{ background: 'var(--bg-deep)' }}>{t('settingsAudit.latest50')}</option>
                 <option value={100} style={{ background: 'var(--bg-deep)' }}>{t('settingsAudit.latest100')}</option>
                 <option value={250} style={{ background: 'var(--bg-deep)' }}>{t('settingsAudit.latest250')}</option>
               </select>
            </div>
         </div>
      </div>

      {/* Main Table */}
      <div className="glass" style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
         <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
               <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '20px 24px', fontSize: '11px', fontWeight: '900', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('settingsAudit.headers.time')}</th>
                  <th style={{ padding: '20px 24px', fontSize: '11px', fontWeight: '900', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('settingsAudit.headers.actor')}</th>
                  {activeTab === 'ticket' && <th style={{ padding: '20px 24px', fontSize: '11px', fontWeight: '900', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('settingsAudit.headers.ticket')}</th>}
                  <th style={{ padding: '20px 24px', fontSize: '11px', fontWeight: '900', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('settingsAudit.headers.action')}</th>
                  <th style={{ padding: '20px 24px', fontSize: '11px', fontWeight: '900', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('settingsAudit.headers.details')}</th>
               </tr>
            </thead>
            <tbody>
               {loading ? (
                  <tr>
                     <td colSpan={5} style={{ padding: '100px', textAlign: 'center' }}>
                        <div className="premium-loader"></div>
                        <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontWeight: '700' }}>{t('common.messages.loading')}</p>
                     </td>
                  </tr>
               ) : filteredLogs.length === 0 ? (
                  <tr>
                     <td colSpan={5} style={{ padding: '100px', textAlign: 'center' }}>
                        <History size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                        <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{t('common.messages.noResults')}</p>
                     </td>
                  </tr>
               ) : (
                  filteredLogs.map((log) => (
                    <tr 
                      key={log.id} 
                      className="audit-row"
                      onClick={() => activeTab === 'ticket' && router.push(`/tickets/${log.ticket_id}`)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'all 0.2s', cursor: activeTab === 'ticket' ? 'pointer' : 'default' }}
                    >
                       <td style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                             <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>{formatDate(log.created_at)}</span>
                             <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{t('settingsAudit.uuidPrefix')}: {log.id.slice(0, 13)}...</span>
                          </div>
                       </td>
                       <td style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                             <div style={{ width: '30px', height: '30px', borderRadius: '10px', background: 'var(--border)', overflow: 'hidden', position: 'relative' }}>
                                <Image 
                                  src={log.performer?.avatar_url || `https://ui-avatars.com/api/?name=${log.performer?.full_name || t('settingsAudit.systemFallback')}`} 
                                  fill
                                  style={{ objectFit: 'cover' }} 
                                  alt={log.performer?.full_name || 'Avatar'}
                                />
                             </div>
                             <span style={{ fontSize: '13px', fontWeight: '700' }}>{log.performer?.full_name || t('settingsAudit.systemFallback')}</span>
                          </div>
                       </td>
                       {activeTab === 'ticket' && (
                         <td style={{ padding: '20px 24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                               <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--primary)' }}>#{log.tickets?.ticket_no || 'N/A'}</span>
                               <span style={{ fontSize: '10px', color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.tickets?.subject}</span>
                            </div>
                         </td>
                       )}
                       <td style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                             {getActionIcon(log.action_type)}
                             <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>{getActionLabel(log.action_type)}</span>
                          </div>
                       </td>
                       <td style={{ padding: '20px 24px' }}>
                          <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                             {log.action_type === 'status_change' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                   <span className="status-tag-dim">{translateTicketStatus(log.from_status, locale)}</span>
                                   <ChevronRight size={12} opacity={0.3} />
                                   <span className="status-tag-bright">{translateTicketStatus(log.to_status, locale)}</span>
                                </div>
                             )}
                             {log.action_type === 'transfer' && log.target_user && (
                                <span style={{ color: 'var(--primary)', fontWeight: '700' }}>🎯 {t('settingsAudit.transferTo')}: {log.target_user.full_name}</span>
                             )}
                             <span style={{ opacity: 0.7, fontStyle: 'italic', maxWidth: '300px' }}>{log.note || '-'}</span>
                             {activeTab === 'system' && (log.new_data || log.old_data) && (
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setSelectedLog(log);
                                   setShowDetails(true);
                                 }}
                                 className="glass-interactive"
                                 style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '10px', width: 'fit-content', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary)', border: 'none', fontWeight: '800', marginTop: '4px' }}
                               >
                                 {t('common.messages.confirmAction')} (Details)
                               </button>
                             )}
                          </div>
                       </td>
                    </tr>
                  ))
               )}
            </tbody>
         </table>

         {/* Details Modal */}
         {showDetails && selectedLog && (
           <div className="flex-center" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, backdropFilter: 'blur(10px)' }}>
             <div className="glass" style={{ width: '90%', maxWidth: '800px', maxHeight: '800px', overflowY: 'auto', padding: '32px', position: 'relative' }}>
                <button 
                  onClick={() => setShowDetails(false)}
                  style={{ position: 'absolute', right: '24px', top: '24px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={24} />
                </button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                   <div style={{ background: 'var(--primary-glow)', padding: '12px', borderRadius: '12px' }}>
                      {getActionIcon(selectedLog.action_type)}
                   </div>
                   <div>
                      <h2 style={{ fontSize: '20px', fontWeight: '800' }}>{getActionLabel(selectedLog.action_type)}</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{formatDate(selectedLog.created_at)} • {selectedLog.performer?.full_name}</p>
                   </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: selectedLog.old_data ? '1fr 1fr' : '1fr', gap: '24px' }}>
                   {selectedLog.old_data && (
                     <div>
                        <h3 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--danger)', marginBottom: '12px', textTransform: 'uppercase' }}>Old Data</h3>
                        <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', fontSize: '12px', color: 'var(--text-muted)', overflowX: 'auto', border: '1px solid var(--border)' }}>
                           {JSON.stringify(selectedLog.old_data, null, 2)}
                        </pre>
                     </div>
                   )}
                   {selectedLog.new_data && (
                     <div>
                        <h3 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--success)', marginBottom: '12px', textTransform: 'uppercase' }}>New Data</h3>
                        <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', fontSize: '12px', color: 'var(--primary)', overflowX: 'auto', border: '1px solid var(--primary-glow)' }}>
                           {JSON.stringify(selectedLog.new_data, null, 2)}
                        </pre>
                     </div>
                   )}
                </div>

                {selectedLog.note && (
                  <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                     <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Note: {selectedLog.note}</p>
                  </div>
                )}
             </div>
           </div>
         )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .audit-row:hover { background: rgba(255,255,255,0.03) !important; transform: scale(1.001); }
        .status-tag-dim { font-size: 10px; font-weight: 800; padding: 2px 8px; background: rgba(255,255,255,0.05); border-radius: 4px; opacity: 0.5; }
        .status-tag-bright { font-size: 10px; font-weight: 800; padding: 2px 8px; background: var(--primary-glow); color: var(--primary); border-radius: 4px; border: 1px solid rgba(0, 242, 254, 0.2); }
        .premium-loader { width: 32px; height: 32px; border: 3px solid rgba(0, 242, 254, 0.1); border-top: 3px solid var(--primary); border-radius: 50%; animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite; margin: 0 auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
