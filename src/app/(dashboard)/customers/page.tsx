'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Users,
  Search,
  Loader2,
  Building,
  MapPin,
  Ticket,
  ArrowRight,
  User as UserIcon,
  RefreshCcw,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  ExternalLink,
  FileText,
  Copy,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import Skeleton from '@/components/ui/Skeleton';
import { getHospitalColorStyles } from '@/lib/inbox/colors';
import { useAppContext } from '@/contexts/AppContext';
import useSWR from 'swr';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Modal,
  PageHeader,
} from '@/components/ui';
import styles from '@/components/reports/reports.module.css';

const CUSTOMERS_PAGE_SIZE = 30;

export default function CustomersPage() {
  const { effectiveProjectIds, selectedProjectId, projectsLoaded } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'created_at',
    direction: 'desc',
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [selectedProjectId]);

  const fetcher = async (): Promise<{ rows: any[]; totalCount: number }> => {
    if (Array.isArray(effectiveProjectIds) && effectiveProjectIds.length === 0) {
      return { rows: [], totalCount: 0 };
    }

    const from = (page - 1) * CUSTOMERS_PAGE_SIZE;
    const to = from + CUSTOMERS_PAGE_SIZE - 1;

    const customerListSelect = `
      id,
      display_name,
      full_name,
      line_username,
      line_user_id,
      avatar_url,
      project_id,
      organization_id,
      department_id,
      position_id,
      status,
      created_at,
      projects:project_id (id, name, code, primary_color),
      organizations (name),
      departments (name),
      positions (name)
    `;

    let query = supabase
      .from('customers')
      .select(customerListSelect, { count: 'exact' });

    if (effectiveProjectIds && effectiveProjectIds.length > 0) {
      query = query.in('project_id', effectiveProjectIds);
    }

    if (debouncedSearch) {
      query = query.or(
        `display_name.ilike.%${debouncedSearch}%,full_name.ilike.%${debouncedSearch}%,line_username.ilike.%${debouncedSearch}%`
      );
    }

    const sortColumn = sortConfig.key === 'display_name' ? 'display_name' : 'created_at';
    const { data, count, error: fetchErr } = await query
      .order(sortColumn, { ascending: sortConfig.direction === 'asc' })
      .range(from, to);

    if (fetchErr) {
      console.warn('Initial fetch failed, trying compact fallback:', fetchErr.message);
      let fallbackQuery = supabase
        .from('customers')
        .select('id, display_name, full_name, line_username, line_user_id, project_id, organization_id, department_id, position_id, created_at', {
          count: 'exact',
        });

      if (effectiveProjectIds && effectiveProjectIds.length > 0) {
        fallbackQuery = fallbackQuery.in('project_id', effectiveProjectIds);
      }
      if (debouncedSearch) {
        fallbackQuery = fallbackQuery.or(
          `display_name.ilike.%${debouncedSearch}%,full_name.ilike.%${debouncedSearch}%,line_username.ilike.%${debouncedSearch}%`
        );
      }

      const { data: basicData, count: basicCount, error: basicErr } = await fallbackQuery
        .order(sortColumn, { ascending: sortConfig.direction === 'asc' })
        .range(from, to);

      if (basicErr) throw basicErr;
      return { rows: basicData || [], totalCount: basicCount || 0 };
    }
    return { rows: data || [], totalCount: count || 0 };
  };

  const swrKey = projectsLoaded
    ? ['customers_list', page, debouncedSearch, sortConfig.key, sortConfig.direction, selectedProjectId, (effectiveProjectIds || []).join(',')]
    : null;
  const { data: customersPayload, error: swrError, isLoading: isSwrLoading, mutate } = useSWR(swrKey, fetcher);

  const customers = useMemo(() => customersPayload?.rows || [], [customersPayload?.rows]);
  const totalCustomersCount = customersPayload?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCustomersCount / CUSTOMERS_PAGE_SIZE));
  const loading = (!projectsLoaded || isSwrLoading) && !customersPayload;
  const error = swrError?.message || null;

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerTickets, setCustomerTickets] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [profileCustomer, setProfileCustomer] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const openHistory = async (customer: any) => {
    setSelectedCustomer(customer);
    setLoadingHistory(true);
    setCustomerTickets([]);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_no, subject, status, priority, module, created_at, resolved_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCustomerTickets(data || []);
    } catch (err: any) {
      console.error('Error fetching history:', err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredCustomers = useMemo(() => {
    const result = customers.filter((c) => {
      const name = String(c.display_name || '').toLowerCase();
      const fullName = String(c.full_name || '').toLowerCase();
      const lineName = String(c.line_username || '').toLowerCase();
      const query = searchTerm.toLowerCase();
      return name.includes(query) || fullName.includes(query) || lineName.includes(query);
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        switch (sortConfig.key) {
          case 'display_name':
            aValue = a.display_name;
            bValue = b.display_name;
            break;
          case 'organization':
            aValue = `${a.organizations?.name || ''} ${a.departments?.name || ''}`;
            bValue = `${b.organizations?.name || ''} ${b.departments?.name || ''}`;
            break;
          case 'created_at':
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
            break;
          default:
            aValue = a[sortConfig.key];
            bValue = b[sortConfig.key];
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [customers, searchTerm, sortConfig]);

  if (loading && !isRefreshing) {
    return (
      <div className={`animate-page-in ${styles.pageStack}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Skeleton width={260} height={32} marginBottom={8} />
            <Skeleton width={220} height={16} />
          </div>
          <Skeleton width={40} height={36} borderRadius={8} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardBody>
                <Skeleton width="45%" height={12} marginBottom={10} />
                <Skeleton width="55%" height={28} />
              </CardBody>
            </Card>
          ))}
        </div>

        <Card>
          <CardBody>
            <Skeleton width="100%" height={40} borderRadius={8} marginBottom={16} />
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width="100%" height={56} borderRadius={8} marginBottom={10} />
            ))}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className={`animate-page-in ${styles.pageStack}`}>
      <PageHeader
        title="Customer Management"
        subtitle="รายชื่อลูกค้าและพนักงานที่ลงทะเบียนผ่าน LINE OA"
        badge={
          <Badge variant="primary" size="md">
            {totalCustomersCount} รายการ
          </Badge>
        }
        actions={
          <Button
            variant="secondary"
            size="md"
            iconOnly
            onClick={handleRefresh}
            aria-label="รีเฟรชรายชื่อลูกค้า"
          >
            <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
          </Button>
        }
      />

      {error ? (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            background: 'var(--color-danger-soft)',
            color: 'var(--color-danger-text)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-danger-border)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>Query Error Detected</p>
            <p style={{ fontSize: 'var(--text-xs)' }}>{error}</p>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        {[
          { label: 'Total Customers', val: customers.length, color: '#1D4ED8', bg: 'var(--color-primary-soft)', icon: Users },
          { label: 'Active Sessions', val: customers.filter((c) => c.status === 'active').length || 0, color: '#059669', bg: 'var(--color-success-soft)', icon: Ticket },
          { label: 'Organization Partners', val: [...new Set(customers.map((c) => c.organization_id).filter(Boolean))].length, color: '#0D9488', bg: 'var(--color-info-soft)', icon: Building },
          { label: 'System Regions', val: 5, color: '#D97706', bg: 'var(--color-warning-soft)', icon: MapPin },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>{stat.label}</span>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-md)',
                    background: stat.bg,
                    color: stat.color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-hidden="true"
                >
                  <stat.icon size={16} />
                </span>
              </div>
              <p className="tabular-nums" style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text)' }}>
                {stat.val}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <div style={{ marginBottom: 20 }}>
            <Input
              id="customers-search-input"
              type="text"
              aria-label="ค้นหาตามชื่อลูกค้า"
              placeholder="ค้นหาตามชื่อลูกค้า, ชื่อจริง หรือ LINE username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={16} aria-hidden="true" />}
            />
          </div>

          <div className={styles.customersTableWrap}>
            <table className={styles.customersTable}>
              <thead>
                <tr>
                  {[
                    { key: 'display_name', label: 'Customer Profile' },
                    { key: 'organization', label: 'Organization / Dept' },
                    { key: 'status', label: 'Contact Status', noSort: true },
                    { key: 'created_at', label: 'Created Date' },
                    { key: 'actions', label: 'Actions', noSort: true, textAlign: 'right' as const },
                  ].map((col) => (
                    <th key={col.key} style={{ textAlign: col.textAlign || 'left' }}>
                      {col.noSort ? (
                        col.label
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className={styles.customersSortBtn}
                        >
                          {col.label}
                          {sortConfig.key === col.key ? (
                            sortConfig.direction === 'asc' ? (
                              <ArrowUp size={12} aria-hidden="true" />
                            ) : (
                              <ArrowDown size={12} aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown size={12} style={{ opacity: 0.4 }} aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--color-surface-subtle)',
                            overflow: 'hidden',
                            border: '1px solid var(--color-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {c.avatar_url ? (
                            <img src={c.avatar_url} alt={c.full_name || c.display_name || 'avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <UserIcon size={20} color="var(--color-text-muted)" aria-hidden="true" />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                              {c.full_name || c.display_name}
                            </span>
                            {c.projects?.code ? (
                              <Badge variant="neutral" size="sm" dot={c.projects.primary_color || '#1D4ED8'}>
                                {c.projects.code}
                              </Badge>
                            ) : null}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                            <strong style={{ color: 'var(--color-success-text)' }}>LINE:</strong> {c.line_username || 'Not Captured'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-primary)' }}>
                          {c.organizations?.name || 'Unspecified'}
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {c.departments?.name || 'No Department'} • {c.positions?.name || 'General Staff'}
                        </span>
                      </div>
                    </td>

                    <td>
                      <Badge variant="success" size="sm" dot>
                        CONNECTED
                      </Badge>
                    </td>

                    <td className="tabular-nums">
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                        {new Date(c.created_at).toLocaleDateString('th-TH')}
                      </p>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          iconOnly
                          onClick={() => openHistory(c)}
                          aria-label={`ดูประวัติใบงานของ ${c.full_name || c.display_name}`}
                          title="ดูประวัติใบงาน"
                        >
                          <Ticket size={15} color="var(--color-primary)" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          iconOnly
                          onClick={() => {
                            setProfileCustomer(c);
                            setCopiedId(false);
                          }}
                          aria-label={`ดูโปรไฟล์ของ ${c.full_name || c.display_name}`}
                          title="ดูโปรไฟล์ลูกค้า"
                        >
                          <ArrowRight size={15} aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px 16px' }}>
                      <EmptyState
                        compact
                        icon={<Users size={36} color="var(--color-text-subtle)" aria-hidden="true" />}
                        title="No Customers Found"
                        description="ยังไม่มีข้อมูลพนักงานที่ลงทะเบียน"
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid var(--color-border)',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <span className="tabular-nums" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              หน้า {page} / {totalPages} • แสดง {customers.length} จากทั้งหมด {totalCustomersCount} รายการ
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                leftIcon={<ChevronLeft size={14} aria-hidden="true" />}
              >
                ก่อนหน้า
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                rightIcon={<ChevronRight size={14} aria-hidden="true" />}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* History Modal */}
      <Modal
        isOpen={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        size="lg"
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color="var(--color-primary)" aria-hidden="true" />
            Ticket History
          </span>
        }
        description={
          selectedCustomer
            ? `ประวัติการแจ้งงานของ: ${selectedCustomer.full_name || selectedCustomer.display_name}`
            : undefined
        }
      >
        {loadingHistory ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 12 }}>
            <Loader2 size={28} className="animate-spin" color="var(--color-primary)" />
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>กำลังโหลดประวัติ...</p>
          </div>
        ) : customerTickets.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customerTickets.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-primary-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary)',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    <FileText size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span className="tabular-nums" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                        #{t.ticket_no}
                      </span>
                      <Badge variant={t.status?.toLowerCase() === 'closed' || t.status?.toLowerCase() === 'resolved' ? 'success' : 'warning'} size="sm">
                        {t.status?.toUpperCase()}
                      </Badge>
                    </div>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{t.subject}</p>
                    <p className="tabular-nums" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                      แจ้งเมื่อ: {new Date(t.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
                <Link href={`/tickets/${t.id}`} aria-label={`เปิดใบงาน ${t.ticket_no}`}>
                  <Button variant="secondary" size="sm" iconOnly>
                    <ExternalLink size={15} aria-hidden="true" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact icon={<FileText size={32} aria-hidden="true" />} title="ไม่พบประวัติการแจ้งงาน" />
        )}
      </Modal>

      {/* Customer Profile Modal */}
      {(() => {
        const brand = profileCustomer ? getHospitalColorStyles(profileCustomer.organizations?.name) : null;
        return (
          <Modal
            isOpen={Boolean(profileCustomer)}
            onClose={() => setProfileCustomer(null)}
            size="md"
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <UserIcon size={18} color={brand?.accent || 'var(--color-primary)'} aria-hidden="true" />
                ข้อมูลโปรไฟล์ลูกค้า
              </span>
            }
            footer={
              profileCustomer ? (
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Ticket size={16} aria-hidden="true" />}
                  onClick={() => {
                    const target = profileCustomer;
                    setProfileCustomer(null);
                    void openHistory(target);
                  }}
                >
                  ประวัติการแจ้งงาน
                </Button>
              ) : null
            }
          >
            {profileCustomer && brand ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 'var(--radius-xl)',
                      background: 'var(--color-surface-subtle)',
                      overflow: 'hidden',
                      border: `2px solid ${brand.accent}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    {profileCustomer.avatar_url ? (
                      <img src={profileCustomer.avatar_url} alt={profileCustomer.full_name || profileCustomer.display_name || 'avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <UserIcon size={36} color="var(--color-text-muted)" aria-hidden="true" />
                    )}
                  </div>

                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
                    {profileCustomer.full_name || profileCustomer.display_name}
                  </h3>
                  {profileCustomer.display_name && profileCustomer.full_name ? (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2, marginBottom: 8 }}>
                      LINE Display: {profileCustomer.display_name}
                    </p>
                  ) : null}
                  <Badge variant="success" size="sm" dot>
                    CONNECTED TO LINE OA
                  </Badge>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-subtle)' }}>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building size={12} color={brand.accent} aria-hidden="true" /> องค์กร/บริษัท
                    </p>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                      {profileCustomer.organizations?.name || 'ไม่ระบุ'}
                    </p>
                  </div>

                  <div style={{ padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-subtle)' }}>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={12} color="var(--color-primary)" aria-hidden="true" /> แผนก / หน่วยงาน
                    </p>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                      {profileCustomer.departments?.name || 'ไม่ระบุ'}
                    </p>
                  </div>

                  <div style={{ padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-subtle)' }}>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <UserIcon size={12} color="var(--color-success)" aria-hidden="true" /> ตำแหน่งงาน
                    </p>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                      {profileCustomer.positions?.name || 'ไม่ระบุ'}
                    </p>
                  </div>

                  <div style={{ padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-subtle)' }}>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={12} color="var(--color-warning)" aria-hidden="true" /> วันที่ลงทะเบียน
                    </p>
                    <p className="tabular-nums" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                      {new Date(profileCustomer.created_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                    </p>
                  </div>

                  <div style={{ padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-subtle)', gridColumn: 'span 2' }}>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      LINE Username
                    </p>
                    <p className="tabular-nums" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                      {profileCustomer.line_username || 'ไม่พบบันทึก'}
                    </p>
                  </div>

                  <div
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface-subtle)',
                      gridColumn: 'span 2',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        LINE User ID
                      </p>
                      <p className="tabular-nums" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-all' }}>
                        {profileCustomer.line_user_id || 'ไม่พบบันทึก'}
                      </p>
                    </div>
                    {profileCustomer.line_user_id ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        iconOnly
                        aria-label="คัดลอก LINE User ID"
                        onClick={() => {
                          void navigator.clipboard.writeText(profileCustomer.line_user_id);
                          setCopiedId(true);
                          setTimeout(() => setCopiedId(false), 2000);
                        }}
                      >
                        {copiedId ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-success-text)' }}>✓</span>
                        ) : (
                          <Copy size={14} aria-hidden="true" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </Modal>
        );
      })()}
    </div>
  );
}
