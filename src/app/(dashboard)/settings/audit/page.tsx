'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Activity,
  ArrowRight,
  CheckCheck,
  ChevronRight,
  Clock,
  Edit3,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  Loader2,
  Lock,
  Mail,
  MessageSquarePlus,
  Plus,
  Search,
  Shield,
  Ticket,
  Trash2,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { auditService } from '@/lib/services/auditService';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { translateAuditAction, translateTicketStatus } from '@/lib/i18n/staff';
import { clearSystemLogsAction, clearTicketLogsAction } from '@/app/actions/auditActions';
import { useNotificationContext } from '@/contexts/NotificationContext';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui';
import styles from '../settings.module.css';

export default function AuditLogPage() {
  const { t, locale } = useStaffLocale();
  const { userProfile } = useAppContext();
  const { addToast } = useNotificationContext();

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

  const stats = React.useMemo(() => {
    const total = logs.length;
    const uniquePerformers = new Set(logs.map((l) => l.performer_id).filter(Boolean)).size;
    const criticalActions = logs.filter((l) =>
      ['staff_delete', 'staff_permission_update', 'master_delete', 'branding_update', 'sla_update'].includes(
        l.action_type?.toLowerCase()
      )
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
          limit,
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

  useEffect(() => {
    setSelectedAction('all');
    setSearchTerm('');
  }, [activeTab]);

  const getActionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'claim':
        return <Zap size={14} color="var(--color-warning)" aria-hidden="true" />;
      case 'transfer':
        return <ArrowRight size={14} color="var(--color-info)" aria-hidden="true" />;
      case 'resolve':
        return <CheckCheck size={14} color="var(--color-success)" aria-hidden="true" />;
      case 'status_change':
        return <History size={14} color="var(--color-primary)" aria-hidden="true" />;
      case 'staff_create':
        return <User size={14} color="var(--color-primary)" aria-hidden="true" />;
      case 'staff_delete':
        return <Trash2 size={14} color="var(--color-danger)" aria-hidden="true" />;
      case 'staff_permission_update':
        return <Lock size={14} color="var(--color-warning)" aria-hidden="true" />;
      case 'branding_update':
        return <Activity size={14} color="var(--color-warning)" aria-hidden="true" />;
      case 'dept_create':
        return <Shield size={14} color="var(--color-primary)" aria-hidden="true" />;
      case 'sla_update':
        return <Clock size={14} color="var(--color-warning)" aria-hidden="true" />;
      case 'master_create':
        return <Plus size={14} color="var(--color-success)" aria-hidden="true" />;
      case 'master_update':
        return <Edit3 size={14} color="var(--color-info)" aria-hidden="true" />;
      case 'master_delete':
        return <Trash2 size={14} color="var(--color-danger)" aria-hidden="true" />;
      case 'master_toggle':
        return <Activity size={14} color="var(--color-warning)" aria-hidden="true" />;
      case 'profile_update':
        return <User size={14} color="var(--color-info)" aria-hidden="true" />;
      case 'template_add':
        return <MessageSquarePlus size={14} color="var(--color-success)" aria-hidden="true" />;
      case 'template_delete':
        return <Trash2 size={14} color="var(--color-danger)" aria-hidden="true" />;
      case 'reopen':
        return <ArrowRight size={14} color="var(--color-primary)" aria-hidden="true" />;
      case 'note':
        return <FileText size={14} color="var(--color-warning)" aria-hidden="true" />;
      case 'message':
        return <Mail size={14} color="var(--color-info)" aria-hidden="true" />;
      default:
        return <Info size={14} color="var(--color-text-muted)" aria-hidden="true" />;
    }
  };

  const getActionLabel = (type: string) => translateAuditAction(type, locale);

  const filteredLogs = logs.filter((log) => {
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
    const dataToExport = filteredLogs.map((log) => ({
      [t('settingsAudit.headers.time')]: formatDate(log.created_at),
      [t('settingsAudit.headers.actor')]: log.performer?.full_name || t('settingsAudit.systemFallback'),
      [t('settingsAudit.headers.action')]: getActionLabel(log.action_type),
      ...(activeTab === 'ticket'
        ? {
            [t('settingsAudit.headers.ticket')]: log.tickets?.ticket_no || 'N/A',
            [t('settingsAudit.headers.details')]: log.tickets?.subject || '',
          }
        : {
            [t('settingsAudit.headers.details')]: log.note || '',
          }),
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

      const tableData = filteredLogs.map((log) => [
        formatDate(log.created_at),
        log.performer?.full_name || t('settingsAudit.systemFallback'),
        getActionLabel(log.action_type),
        activeTab === 'ticket' ? log.tickets?.ticket_no || 'N/A' : log.note || '',
      ]);

      doc.autoTable({
        head: [
          [
            t('settingsAudit.headers.time'),
            t('settingsAudit.headers.actor'),
            t('settingsAudit.headers.action'),
            activeTab === 'ticket' ? t('settingsAudit.headers.ticket') : t('settingsAudit.headers.details'),
          ],
        ],
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
      const result = activeTab === 'ticket' ? await clearTicketLogsAction() : await clearSystemLogsAction();

      if (result.success) {
        addToast({
          id: `clear-log-${Date.now()}`,
          type: 'ticket',
          title: t('settingsAudit.messages.clearSuccessTitle'),
          body: t('settingsAudit.messages.clearSuccessBody'),
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
    <div className={styles.page}>
      <PageHeader
        title={
          <span className={styles.headerTitleRow}>
            <span className={`${styles.statIcon} ${styles.statIconPrimary}`}>
              <Shield size={18} aria-hidden="true" />
            </span>
            <span>{t('settingsAudit.title')}</span>
          </span>
        }
        subtitle={t('settingsAudit.subtitle')}
        actions={
          <>
            {userProfile?.role === 'Administrator' && (
              <Button
                variant="danger"
                onClick={handleClearLogs}
                loading={clearing}
                leftIcon={<Zap size={15} aria-hidden="true" />}
              >
                {t('settingsAudit.clearLogs')}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleExportExcel}
              disabled={!canEdit}
              leftIcon={<FileSpreadsheet size={15} color="var(--color-success)" aria-hidden="true" />}
            >
              {t('settingsAudit.exportExcel')}
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportPDF}
              disabled={!canEdit}
              leftIcon={<FileText size={15} color="var(--color-danger)" aria-hidden="true" />}
            >
              {t('settingsAudit.exportPdf')}
            </Button>
          </>
        }
      />

      {/* Summary Stats */}
      <div className={styles.statsGrid}>
        <Card>
          <CardBody compact className={styles.statCardBody}>
            <div className={`${styles.statIcon} ${styles.statIconPrimary}`}>
              <Activity size={18} aria-hidden="true" />
            </div>
            <div>
              <p className={styles.statLabel}>Total Events</p>
              <div className={styles.statValueRow}>
                <span className={styles.statValue}>{stats.total}</span>
                <span className={styles.statUnit}>logs</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody compact className={styles.statCardBody}>
            <div className={`${styles.statIcon} ${styles.statIconInfo}`}>
              <Users size={18} aria-hidden="true" />
            </div>
            <div>
              <p className={styles.statLabel}>Active Staff</p>
              <div className={styles.statValueRow}>
                <span className={styles.statValue}>{stats.uniquePerformers}</span>
                <span className={styles.statUnit}>actors</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody compact className={styles.statCardBody}>
            <div className={`${styles.statIcon} ${styles.statIconDanger}`}>
              <Shield size={18} aria-hidden="true" />
            </div>
            <div>
              <p className={styles.statLabel}>Critical Actions</p>
              <div className={styles.statValueRow}>
                <span className={styles.statValue}>{stats.criticalActions}</span>
                <span className={styles.statUnit}>security</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className={styles.segmentedTabs} role="tablist" aria-label={t('settingsAudit.title')}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ticket'}
          onClick={() => setActiveTab('ticket')}
          className={`${styles.segmentedTab} ${activeTab === 'ticket' ? styles.segmentedTabActive : ''}`}
        >
          <Ticket size={15} aria-hidden="true" />
          <span>{t('settingsAudit.ticketTab')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'system'}
          onClick={() => setActiveTab('system')}
          className={`${styles.segmentedTab} ${activeTab === 'system' ? styles.segmentedTabActive : ''}`}
        >
          <Activity size={15} aria-hidden="true" />
          <span>{t('settingsAudit.systemTab')}</span>
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardBody compact>
          <div className={styles.filterBar}>
            <Input
              type="search"
              aria-label={
                activeTab === 'ticket'
                  ? t('settingsAudit.ticketSearchPlaceholder')
                  : t('settingsAudit.systemSearchPlaceholder')
              }
              placeholder={
                activeTab === 'ticket'
                  ? t('settingsAudit.ticketSearchPlaceholder')
                  : t('settingsAudit.systemSearchPlaceholder')
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={16} aria-hidden="true" />}
            />

            <div className={styles.filterSelects}>
              <div className={styles.filterSelectItem}>
                <Select
                  aria-label={t('settingsAudit.allAgents')}
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                >
                  <option value="all">{t('settingsAudit.allAgents')}</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className={styles.filterSelectItem}>
                <Select
                  aria-label={t('settingsAudit.headers.action')}
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                >
                  <option value="all">
                    {t('settingsAudit.headers.action')}: {t('dashboard.tabs.all')}
                  </option>
                  {activeTab === 'ticket' ? (
                    <>
                      <option value="claim">{translateAuditAction('claim', locale)}</option>
                      <option value="transfer">{translateAuditAction('transfer', locale)}</option>
                      <option value="resolve">{translateAuditAction('resolve', locale)}</option>
                      <option value="status_change">{translateAuditAction('status_change', locale)}</option>
                      <option value="reopen">{translateAuditAction('reopen', locale)}</option>
                      <option value="note">{translateAuditAction('note', locale)}</option>
                      <option value="message">{translateAuditAction('message', locale)}</option>
                    </>
                  ) : (
                    <>
                      <option value="STAFF_CREATE">{translateAuditAction('staff_create', locale)}</option>
                      <option value="STAFF_DELETE">{translateAuditAction('staff_delete', locale)}</option>
                      <option value="STAFF_PERMISSION_UPDATE">
                        {translateAuditAction('staff_permission_update', locale)}
                      </option>
                      <option value="BRANDING_UPDATE">{translateAuditAction('branding_update', locale)}</option>
                      <option value="SLA_UPDATE">{translateAuditAction('sla_update', locale)}</option>
                      <option value="MASTER_CREATE">{translateAuditAction('master_create', locale)}</option>
                      <option value="MASTER_UPDATE">{translateAuditAction('master_update', locale)}</option>
                      <option value="MASTER_DELETE">{translateAuditAction('master_delete', locale)}</option>
                      <option value="MASTER_TOGGLE">{translateAuditAction('master_toggle', locale)}</option>
                      <option value="PROFILE_UPDATE">{translateAuditAction('profile_update', locale)}</option>
                      <option value="TEMPLATE_ADD">{translateAuditAction('template_add', locale)}</option>
                      <option value="TEMPLATE_DELETE">{translateAuditAction('template_delete', locale)}</option>
                    </>
                  )}
                </Select>
              </div>

              <div style={{ minWidth: '130px' }}>
                <Select
                  aria-label="จำนวนรายการล่าสุด"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  <option value={50}>{t('settingsAudit.latest50')}</option>
                  <option value={100}>{t('settingsAudit.latest100')}</option>
                  <option value={250}>{t('settingsAudit.latest250')}</option>
                </Select>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Main Sticky Table */}
      <Card>
        {loading ? (
          <div
            className="flex-center"
            style={{ padding: 'var(--space-12)', flexDirection: 'column', gap: 'var(--space-3)' }}
            role="status"
          >
            <Loader2 className="animate-spin" size={28} color="var(--color-primary)" aria-hidden="true" />
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              {t('common.messages.loading')}
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: 'var(--space-6)' }}>
            <EmptyState compact icon={<History size={20} aria-hidden="true" />} title={t('common.messages.noResults')} />
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('settingsAudit.headers.time')}</th>
                  <th>{t('settingsAudit.headers.actor')}</th>
                  {activeTab === 'ticket' && <th>{t('settingsAudit.headers.ticket')}</th>}
                  <th>{t('settingsAudit.headers.action')}</th>
                  <th>{t('settingsAudit.headers.details')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span className={styles.monoText} style={{ fontWeight: 'var(--weight-semibold)' }}>
                          {formatDate(log.created_at)}
                        </span>
                        <span
                          className={styles.monoText}
                          style={{ fontSize: '11px', color: 'var(--color-text-subtle)' }}
                        >
                          {t('settingsAudit.uuidPrefix')}: {log.id.slice(0, 13)}...
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-surface-subtle)',
                            border: '1px solid var(--color-border)',
                            overflow: 'hidden',
                            position: 'relative',
                            flexShrink: 0,
                          }}
                        >
                          <Image
                            src={
                              log.performer?.avatar_url ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                log.performer?.full_name || t('settingsAudit.systemFallback')
                              )}`
                            }
                            fill
                            style={{ objectFit: 'cover' }}
                            alt={log.performer?.full_name || 'Avatar'}
                          />
                        </div>
                        <span style={{ fontWeight: 'var(--weight-medium)' }}>
                          {log.performer?.full_name || t('settingsAudit.systemFallback')}
                        </span>
                      </div>
                    </td>

                    {activeTab === 'ticket' && (
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {log.ticket_id ? (
                            <Link href={`/tickets/${log.ticket_id}`} className={styles.ticketLink}>
                              #{log.tickets?.ticket_no || 'N/A'}
                            </Link>
                          ) : (
                            <span className={styles.monoText}>#{log.tickets?.ticket_no || 'N/A'}</span>
                          )}
                          <span
                            style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--color-text-muted)',
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {log.tickets?.subject}
                          </span>
                        </div>
                      </td>
                    )}

                    <td>
                      <Badge variant="neutral" size="md">
                        {getActionIcon(log.action_type)}
                        <span>{getActionLabel(log.action_type)}</span>
                      </Badge>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {log.action_type === 'status_change' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <Badge variant="neutral" size="sm">
                              {translateTicketStatus(log.from_status, locale)}
                            </Badge>
                            <ChevronRight size={12} color="var(--color-text-subtle)" aria-hidden="true" />
                            <Badge variant="primary" size="sm">
                              {translateTicketStatus(log.to_status, locale)}
                            </Badge>
                          </div>
                        )}

                        {log.action_type === 'transfer' && log.target_user && (
                          <span style={{ color: 'var(--color-primary)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-xs)' }}>
                            {t('settingsAudit.transferTo')}: {log.target_user.full_name}
                          </span>
                        )}

                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', maxWidth: '340px' }}>
                          {log.note || '-'}
                        </span>

                        {activeTab === 'system' && (log.new_data || log.old_data) && (
                          <div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedLog(log);
                                setShowDetails(true);
                              }}
                            >
                              {t('common.messages.confirmAction')} (Details)
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Diff / Details Modal */}
      <Modal
        isOpen={Boolean(showDetails && selectedLog)}
        onClose={() => setShowDetails(false)}
        title={selectedLog ? getActionLabel(selectedLog.action_type) : undefined}
        description={
          selectedLog
            ? `${formatDate(selectedLog.created_at)} • ${selectedLog.performer?.full_name || t('settingsAudit.systemFallback')}`
            : undefined
        }
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setShowDetails(false)}>
            {t('common.close') || 'ปิด'}
          </Button>
        }
      >
        {selectedLog && (
          <div className={styles.stackMd}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: selectedLog.old_data ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr',
                gap: 'var(--space-4)',
              }}
            >
              {selectedLog.old_data && (
                <div className={styles.stackSm}>
                  <Badge variant="danger" size="sm">
                    Old Data
                  </Badge>
                  <pre className={styles.diffPre}>{JSON.stringify(selectedLog.old_data, null, 2)}</pre>
                </div>
              )}
              {selectedLog.new_data && (
                <div className={styles.stackSm}>
                  <Badge variant="success" size="sm">
                    New Data
                  </Badge>
                  <pre className={styles.diffPre}>{JSON.stringify(selectedLog.new_data, null, 2)}</pre>
                </div>
              )}
            </div>

            {selectedLog.note && (
              <div className={`${styles.alertBanner} ${styles.alertInfo}`}>
                <span>Note: {selectedLog.note}</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
