'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ChevronLeft,
  Search,
  RefreshCw,
  Loader2,
  Zap,
  ArrowRightLeft,
  CheckCheck,
  Activity,
  FileText,
  Clock,
  User,
  ExternalLink,
  Filter,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { auditLogService } from '@/lib/services/auditLogService';
import type { AuditLogEntry } from '@/types';

type ActionFilter = 'all' | 'claim' | 'status_change' | 'transfer' | 'resolve';
type DateRangeFilter = 'all' | 'today' | '7d' | '30d';

interface ActionStyle {
  label: string;
  color: string;
  bg: string;
  icon: LucideIcon;
}

const ACTION_STYLES: Record<string, ActionStyle> = {
  claim: {
    label: 'รับงาน',
    color: '#00f2fe',
    bg: 'rgba(0, 242, 254, 0.12)',
    icon: Zap,
  },
  status_change: {
    label: 'เปลี่ยนสถานะ',
    color: '#ff9f43',
    bg: 'rgba(255, 159, 67, 0.12)',
    icon: Activity,
  },
  transfer: {
    label: 'โอนงาน',
    color: '#4facfe',
    bg: 'rgba(79, 172, 254, 0.12)',
    icon: ArrowRightLeft,
  },
  resolve: {
    label: 'ปิดงาน',
    color: '#28c76f',
    bg: 'rgba(40, 199, 111, 0.12)',
    icon: CheckCheck,
  },
};

const DEFAULT_ACTION_STYLE: ActionStyle = {
  label: 'กิจกรรมระบบ',
  color: '#94a3b8',
  bg: 'rgba(148, 163, 184, 0.12)',
  icon: FileText,
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('th-TH', {
    year: '2-digit',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const PAGE_SIZE = 30;

export default function AuditLogDashboardPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const loadLogs = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);
    try {
      const data = await auditLogService.fetchAuditLogs(300);
      setLogs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูล Audit Log ได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      const { isAdmin: adminFlag } = await auditLogService.getCurrentUserAdminStatus();
      if (!active) return;

      setIsAdmin(adminFlag);
      setCheckingAuth(false);

      if (adminFlag) {
        await loadLogs();
      } else {
        setLoading(false);
      }
    }

    void init();

    return () => {
      active = false;
    };
  }, [loadLogs]);

  // Realtime subscription when Admin is viewing
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('audit-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_logs' },
        () => {
          void loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, loadLogs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();

    return logs.filter((entry) => {
      if (actionFilter !== 'all' && entry.action_type !== actionFilter) {
        return false;
      }

      if (dateRange !== 'all') {
        const ts = new Date(entry.created_at).getTime();
        if (dateRange === 'today') {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          if (ts < startOfDay.getTime()) return false;
        } else if (dateRange === '7d') {
          if (now - ts > 7 * 24 * 60 * 60 * 1000) return false;
        } else if (dateRange === '30d') {
          if (now - ts > 30 * 24 * 60 * 60 * 1000) return false;
        }
      }

      if (q) {
        const haystack = [
          entry.ticket_no?.toString() ?? '',
          entry.subject ?? '',
          entry.performer_name,
          entry.target_user_name ?? '',
          entry.note ?? '',
          entry.from_status ?? '',
          entry.to_status ?? '',
          entry.action_type,
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [logs, search, actionFilter, dateRange]);

  const stats = useMemo(() => {
    return {
      total: filteredLogs.length,
      claims: filteredLogs.filter((l) => l.action_type === 'claim').length,
      transfers: filteredLogs.filter((l) => l.action_type === 'transfer').length,
      resolves: filteredLogs.filter((l) => l.action_type === 'resolve').length,
    };
  }, [filteredLogs]);

  if (checkingAuth) {
    return (
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '12px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        className="glass flex-center"
        style={{
          maxWidth: '520px',
          margin: '80px auto',
          padding: '48px 32px',
          borderRadius: '24px',
          flexDirection: 'column',
          textAlign: 'center',
          gap: '16px',
          border: '1px solid rgba(234, 84, 85, 0.25)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'rgba(234, 84, 85, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShieldAlert size={32} color="#ea5455" />
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: '800' }}>ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
          หน้า Audit Log Dashboard จำกัดสิทธิ์เฉพาะผู้ดูแลระบบ (Admin / Administrator) เท่านั้น
        </p>
        <Link
          href="/"
          className="glass-interactive"
          style={{
            marginTop: '8px',
            padding: '12px 24px',
            borderRadius: '12px',
            background: 'var(--primary)',
            color: '#0a0e14',
            fontWeight: '800',
            fontSize: '14px',
          }}
        >
          กลับสู่หน้าหลัก
        </Link>
      </div>
    );
  }

  const displayedLogs = filteredLogs.slice(0, visibleCount);

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', lineHeight: '1.15' }}>
              ประวัติการใช้งานระบบ (Audit Logs)
            </h1>
            <p
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginTop: '4px',
              }}
            >
              ADMIN ONLY • REALTIME ACTIVITY TRAIL
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'rgba(0, 242, 254, 0.05)',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#28c76f',
                animation: 'pulse 2s infinite',
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>LIVE</span>
          </div>

          <button
            type="button"
            onClick={() => void loadLogs(true)}
            disabled={refreshing}
            className="glass-interactive"
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {[
          { label: 'กิจกรรมทั้งหมด', value: stats.total, color: '#00f2fe', icon: Activity },
          { label: 'รับงาน (Claim)', value: stats.claims, color: '#ff9f43', icon: Zap },
          { label: 'โอนงาน (Transfer)', value: stats.transfers, color: '#4facfe', icon: ArrowRightLeft },
          { label: 'ปิดงาน (Resolve)', value: stats.resolves, color: '#28c76f', icon: CheckCheck },
        ].map((card) => (
          <div
            key={card.label}
            className="glass"
            style={{
              padding: '18px 20px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: `${card.color}18`,
                color: card.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <card.icon size={20} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{card.label}</p>
              <p style={{ fontSize: '22px', fontWeight: '800', marginTop: '2px' }}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div
        className="glass"
        style={{
          padding: '18px 20px',
          borderRadius: '18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="ค้นหาเลขใบงาน, ผู้ดำเนินการ, หมายเหตุ..."
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 14px 10px 40px',
              color: 'var(--text-main)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Action Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Filter size={14} color="var(--text-muted)" style={{ marginRight: '4px' }} />
          {(
            [
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'claim', label: 'รับงาน' },
              { id: 'status_change', label: 'เปลี่ยนสถานะ' },
              { id: 'transfer', label: 'โอนงาน' },
              { id: 'resolve', label: 'ปิดงาน' },
            ] as Array<{ id: ActionFilter; label: string }>
          ).map((tab) => {
            const active = actionFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActionFilter(tab.id);
                  setVisibleCount(PAGE_SIZE);
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: active ? 'rgba(0, 242, 254, 0.14)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Date Range */}
        <select
          value={dateRange}
          onChange={(e) => {
            setDateRange(e.target.value as DateRangeFilter);
            setVisibleCount(PAGE_SIZE);
          }}
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '9px 14px',
            color: 'var(--text-main)',
            fontSize: '12px',
            fontWeight: '700',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all">ทุกช่วงเวลา</option>
          <option value="today">วันนี้</option>
          <option value="7d">7 วันล่าสุด</option>
          <option value="30d">30 วันล่าสุด</option>
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'rgba(234, 84, 85, 0.12)',
            border: '1px solid rgba(234, 84, 85, 0.25)',
            color: '#ea5455',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="glass" style={{ borderRadius: '20px', overflow: 'hidden' }}>
        {loading ? (
          <div className="flex-center" style={{ height: '300px', flexDirection: 'column', gap: '12px' }}>
            <Loader2 className="animate-spin" size={32} color="var(--primary)" />
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>กำลังโหลดประวัติกิจกรรม...</p>
          </div>
        ) : displayedLogs.length === 0 ? (
          <div className="flex-center" style={{ height: '260px', flexDirection: 'column', gap: '10px', opacity: 0.6 }}>
            <FileText size={40} />
            <p style={{ fontSize: '14px' }}>ไม่พบรายการกิจกรรมที่ตรงกับเงื่อนไข</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    เวลา
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    กิจกรรม
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    ใบงาน / รายการ
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    ผู้ดำเนินการ
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    รายละเอียด / สถานะ
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedLogs.map((entry) => {
                  const style = ACTION_STYLES[entry.action_type] || DEFAULT_ACTION_STYLE;
                  const ActionIcon = style.icon;

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={13} style={{ opacity: 0.6 }} />
                          {formatDateTime(entry.created_at)}
                        </div>
                      </td>

                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '800',
                            color: style.color,
                            background: style.bg,
                          }}
                        >
                          <ActionIcon size={12} />
                          {style.label}
                        </span>
                      </td>

                      <td style={{ padding: '14px 20px', maxWidth: '240px' }}>
                        {entry.entity_type === 'ticket' && entry.entity_id ? (
                          <Link
                            href={`/tickets/${entry.entity_id}`}
                            style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              gap: '2px',
                              color: 'var(--text-main)',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: '800',
                                color: 'var(--primary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              #{entry.ticket_no ?? entry.entity_id.slice(0, 8)}
                              <ExternalLink size={11} />
                            </span>
                            {entry.subject && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--text-muted)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '210px',
                                }}
                              >
                                {entry.subject}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {entry.entity_type}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: 'rgba(255,255,255,0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <User size={13} color="var(--text-muted)" />
                          </div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: '700' }}>{entry.performer_name}</p>
                            {entry.target_user_name && (
                              <p style={{ fontSize: '11px', color: '#4facfe' }}>
                                → {entry.target_user_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '300px' }}>
                        {(entry.from_status || entry.to_status) && (
                          <div style={{ marginBottom: entry.note ? '4px' : 0, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {entry.from_status && (
                              <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', fontSize: '11px' }}>
                                {entry.from_status}
                              </span>
                            )}
                            {entry.from_status && entry.to_status && <span>→</span>}
                            {entry.to_status && (
                              <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(0, 242, 254, 0.12)', color: 'var(--primary)', fontSize: '11px', fontWeight: '700' }}>
                                {entry.to_status}
                              </span>
                            )}
                          </div>
                        )}
                        {entry.note && (
                          <p style={{ fontSize: '12px', color: 'var(--text-main)', opacity: 0.85, lineHeight: '1.4' }}>
                            {entry.note}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {visibleCount < filteredLogs.length && (
          <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              className="glass-interactive"
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              แสดงเพิ่มเติม ({filteredLogs.length - visibleCount} รายการที่เหลือ)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
