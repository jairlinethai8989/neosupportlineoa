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
  Plus,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Clock,
  ExternalLink,
  FileText,
  MessageSquare,
  Copy,
  Calendar
} from 'lucide-react';
import Link from 'next/link';
import Skeleton from '@/components/ui/Skeleton';
import { getHospitalColorStyles } from '@/lib/inbox/colors';
import useSWR from 'swr';

export default function CustomersPage() {
  const fetcher = async (): Promise<any[]> => {
    const customerListSelect = `
      id,
      display_name,
      full_name,
      line_username,
      line_user_id,
      avatar_url,
      organization_id,
      department_id,
      position_id,
      status,
      created_at,
      organizations (name),
      departments (name),
      positions (name)
    `;

    // Fetch explicit columns (excluding heavy metadata JSON) with safety limit
    const { data, error: fetchErr } = await supabase
      .from('customers')
      .select(customerListSelect)
      .order('created_at', { ascending: false })
      .limit(300);

    if (fetchErr) {
       console.warn('Initial fetch failed, trying compact fallback:', fetchErr.message);
       const { data: basicData, error: basicErr } = await supabase
         .from('customers')
         .select('id, display_name, full_name, line_username, line_user_id, organization_id, department_id, position_id, created_at')
         .order('created_at', { ascending: false })
         .limit(300);
       
       if (basicErr) throw basicErr;
       return basicData || [];
    }
    return data || [];
  };

  const { data: customersData, error: swrError, isLoading: isSwrLoading, mutate } = useSWR('customers_list', fetcher);
  
  const customers = customersData || [];
  const loading = isSwrLoading && !customersData;
  const error = swrError?.message || null;

  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });

  // History Modal States
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerTickets, setCustomerTickets] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Profile Modal State
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

  // Lock body scroll when modals are open to prevent page bounce/jump
  useEffect(() => {
    if (selectedCustomer || profileCustomer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedCustomer, profileCustomer]);

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
    const result = customers.filter(c => {
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
      <div className="animate-page-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <Skeleton width={300} height={40} marginBottom={8} />
            <Skeleton width={250} height={20} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Skeleton width={48} height={48} borderRadius={12} />
            <Skeleton width={180} height={48} borderRadius={12} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass" style={{ padding: '24px', borderRadius: '24px' }}>
              <Skeleton width="40%" height={12} marginBottom={12} />
              <Skeleton width="60%" height={32} />
            </div>
          ))}
        </div>

        <div className="glass" style={{ padding: '32px', borderRadius: '32px' }}>
          <Skeleton width="100%" height={56} borderRadius={16} marginBottom={24} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '12px 0' }}>
                <Skeleton width={52} height={52} borderRadius={16} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="30%" height={16} marginBottom={8} />
                  <Skeleton width="20%" height={12} />
                </div>
                <Skeleton width="20%" height={24} />
                <Skeleton width="15%" height={24} />
                <Skeleton width={100} height={44} borderRadius={12} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-in">
      {/* 1. Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-1.5px', marginBottom: '8px' }}>
            Customer Management <span style={{ color: 'var(--primary)', opacity: 0.8 }}>({customers.length})</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>รายชื่อลูกค้าและพนักงานที่ลงทะเบียนผ่าน LINE OA</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
           <button 
             onClick={handleRefresh}
             className="glass-interactive flex-center" 
             style={{ width: '48px', height: '48px', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text-main)' }}
           >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
           </button>
           {/* Removed Add Customer button */}
        </div>
      </div>

      {error && (
         <div className="glass" style={{ padding: '16px', background: 'rgba(234, 84, 85, 0.1)', color: '#ea5455', borderRadius: '16px', border: '1px solid rgba(234, 84, 85, 0.2)', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <AlertCircle size={20} />
            <div>
               <p style={{ fontWeight: '800', fontSize: '14px' }}>Query Error Detected</p>
               <p style={{ fontSize: '12px' }}>{error}</p>
            </div>
         </div>
      )}

      {/* 2. Top Banner Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
         {[
           { label: 'Total Customers', val: customers.length, color: 'var(--primary)', icon: Users },
           { label: 'Active Sessions', val: customers.filter(c => c.status === 'active').length || 0, color: 'var(--success)', icon: Ticket },
           { label: 'Organization Partners', val: [...new Set(customers.map(c => c.organization_id).filter(Boolean))].length, color: '#7367f0', icon: Building },
           { label: 'System Regions', val: 5, color: '#ff9f43', icon: MapPin },
         ].map((stat, i) => (
            <div key={i} className="glass" style={{ padding: '24px', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
               <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05 }}>
                  <stat.icon size={80} color={stat.color} />
               </div>
               <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>{stat.label}</p>
               <h3 style={{ fontSize: '28px', fontWeight: '900', color: stat.color }}>{stat.val}</h3>
            </div>
         ))}
      </div>

      {/* 3. Search and Content Section */}
      <div className="glass" style={{ padding: '32px', borderRadius: '32px', border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.01)' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '24px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
               <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
               <input 
                 type="text" 
                 placeholder="ค้นหาตามชื่อลูกค้า..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 style={{ 
                   width: '100%', 
                   background: 'rgba(255, 255, 255, 0.05)', 
                   border: '1px solid var(--border)', 
                   borderRadius: '16px', 
                   padding: '16px 16px 16px 48px', 
                   color: 'var(--text-main)',
                   fontSize: '15px',
                   outline: 'none'
                 }}
               />
            </div>
         </div>

         {/* Customer Table */}
         <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 12px' }}>
               <thead>
                  <tr style={{ textAlign: 'left' }}>
                    {[
                      { key: 'display_name', label: 'Customer Profile' },
                      { key: 'organization', label: 'Organization / Dept' },
                      { key: 'status', label: 'Contact Status', noSort: true },
                      { key: 'created_at', label: 'Created Date' },
                      { key: 'actions', label: 'Actions', noSort: true, textAlign: 'right' }
                    ].map(col => (
                      <th 
                        key={col.key}
                        onClick={() => !col.noSort && handleSort(col.key)}
                        style={{ 
                          padding: '0 20px', 
                          fontSize: '11px', 
                          fontWeight: '800', 
                          color: 'var(--text-muted)', 
                          textTransform: 'uppercase',
                          cursor: col.noSort ? 'default' : 'pointer',
                          textAlign: (col as any).textAlign || 'left',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: (col as any).textAlign === 'right' ? 'flex-end' : 'flex-start', gap: '8px' }}>
                          {col.label}
                          {!col.noSort && (
                            <span style={{ display: 'flex', alignItems: 'center' }}>
                              {sortConfig.key === col.key ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={12} style={{ opacity: 0.3 }} />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
               </thead>
               <tbody>
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="row-interactive" style={{ animation: 'contentSlideIn 0.4s ease-out forwards', animationDelay: `${Math.min(0.5, (customers.indexOf(c) * 0.05))}s` }}>
                       <td style={{ padding: '16px 20px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '20px 0 0 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                             <div style={{ 
                                width: '52px', 
                                height: '52px', 
                                borderRadius: '16px', 
                                background: 'var(--secondary)', 
                                overflow: 'hidden', 
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                             }}>
                                {c.avatar_url ? (
                                   <img src={c.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : <UserIcon size={24} color="var(--text-muted)" />}
                             </div>
                             <div>
                                <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)' }}>
                                   {c.full_name || c.display_name}
                                </h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                   <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '800' }}>LINE:</span>
                                   <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                      {c.line_username || 'Not Captured'}
                                   </span>
                                </div>
                             </div>
                          </div>
                       </td>
                       <td style={{ padding: '16px 20px', background: 'rgba(255, 255, 255, 0.02)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                             <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>{c.organizations?.name || 'Unspecified'}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                 <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                    {c.departments?.name || 'No Department'}
                                 </span>
                                 <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--text-dim)' }} />
                                 <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                    {c.positions?.name || 'General Staff'}
                                 </span>
                              </div>
                          </div>
                       </td>
                       <td style={{ padding: '16px 20px', background: 'rgba(255, 255, 255, 0.02)' }}>
                          <span style={{ 
                             display: 'inline-flex', 
                             alignItems: 'center', 
                             gap: '6px', 
                             padding: '4px 12px', 
                             borderRadius: '8px', 
                             fontSize: '11px', 
                             fontWeight: '850', 
                             background: 'rgba(40, 199, 111, 0.1)', 
                             color: 'var(--success)',
                             border: '1px solid rgba(40, 199, 111, 0.2)'
                          }}>
                             <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
                             CONNECTED
                          </span>
                       </td>
                       <td style={{ padding: '16px 20px', background: 'rgba(255, 255, 255, 0.02)' }}>
                          <p style={{ fontSize: '13px', fontWeight: '600' }}>{new Date(c.created_at).toLocaleDateString('th-TH')}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                       </td>
                       <td style={{ padding: '16px 20px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '0 20px 20px 0', textAlign: 'right' }}>
                          <button 
                            onClick={() => openHistory(c)}
                            className="glass-interactive flex-center" 
                            style={{ 
                              display: 'inline-flex', 
                              width: '44px', 
                              height: '44px', 
                              borderRadius: '12px', 
                              border: '1px solid var(--border)', 
                              color: 'var(--primary)',
                              marginLeft: '8px',
                              background: 'none',
                              cursor: 'pointer'
                            }}
                            title="View Ticket History"
                          >
                             <Ticket size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              setProfileCustomer(c);
                              setCopiedId(false);
                            }}
                            className="glass-interactive flex-center" 
                            style={{ 
                              display: 'inline-flex', 
                              width: '44px', 
                              height: '44px', 
                              borderRadius: '12px', 
                              border: '1px solid var(--border)', 
                              color: 'var(--text-muted)',
                              marginLeft: '8px',
                              background: 'none',
                              cursor: 'pointer'
                            }}
                            title="View Customer Profile"
                          >
                             <ArrowRight size={18} />
                          </button>
                       </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <tr>
                       <td colSpan={5} style={{ padding: '80px 0', textAlign: 'center', opacity: 0.3 }}>
                          <Users size={64} style={{ marginBottom: '16px' }} />
                          <h4 style={{ fontSize: '18px', fontWeight: '800' }}>No Customers Found</h4>
                          <p style={{ fontSize: '14px' }}>ยังไม่มีข้อมูลพนักงานที่ลงทะเบียน</p>
                       </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .row-interactive:hover td:first-child {
           border-top-left-radius: 20px;
           border-bottom-left-radius: 20px;
        }
        .row-interactive:hover td:last-child {
           border-top-right-radius: 20px;
           border-bottom-right-radius: 20px;
        }
      `}} />

      {/* 4. History Modal */}
      {selectedCustomer && (
         <div style={{
           position: 'fixed',
           inset: 0,
           background: 'rgba(15, 23, 42, 0.7)',
           backdropFilter: 'blur(8px)',
           display: 'flex',
           alignItems: 'center',
           justifyContent: 'center',
           zIndex: 10000,
           padding: '20px',
           animation: 'modalFadeIn 0.3s ease'
         }}>
           <div style={{
             width: '100%',
             maxWidth: '700px',
             background: 'var(--bg-sidebar)',
             borderRadius: '24px',
             border: '1px solid var(--border)',
             display: 'flex',
             flexDirection: 'column',
             maxHeight: '85vh',
             overflow: 'hidden',
             boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
             animation: 'modalContentIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
           }}>
             {/* Modal Header */}
             <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                     <Clock size={20} color="var(--primary)" />
                     <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>Ticket History</h3>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                     ประวัติการแจ้งงานของ: <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{selectedCustomer.full_name || selectedCustomer.display_name}</span>
                  </p>
               </div>
               <button 
                 onClick={() => setSelectedCustomer(null)}
                 style={{ width: '36px', height: '36px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
               >
                 <X size={20} />
               </button>
             </div>

             {/* Modal Content */}
             <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                {loadingHistory ? (
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: '12px' }}>
                      <Loader2 size={32} className="animate-spin" color="var(--primary)" />
                      <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>กำลังโหลดประวัติ...</p>
                   </div>
                ) : customerTickets.length > 0 ? (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {customerTickets.map((t) => (
                         <div key={t.id} className="glass" style={{ padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                               <div style={{ 
                                  width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(54, 153, 255, 0.1)', 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' 
                               }}>
                                  <FileText size={20} />
                               </div>
                               <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                     <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>#{t.ticket_no}</span>
                                     <span style={{ 
                                        fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px',
                                        background: t.status === 'closed' ? 'rgba(40, 199, 111, 0.1)' : 'rgba(255, 159, 67, 0.1)',
                                        color: t.status === 'closed' ? 'var(--success)' : 'var(--warning)'
                                     }}>
                                        {t.status?.toUpperCase()}
                                     </span>
                                  </div>
                                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>{t.subject}</p>
                                  <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                     แจ้งเมื่อ: {new Date(t.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                                  </p>
                               </div>
                            </div>
                            <Link 
                              href={`/tickets/${t.id}`}
                              style={{ 
                                 width: '40px', height: '40px', borderRadius: '10px', border: '1px solid var(--border)', 
                                 display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
                                 background: 'rgba(255,255,255,0.02)'
                              }}
                            >
                               <ExternalLink size={18} />
                            </Link>
                         </div>
                      ))}
                   </div>
                ) : (
                   <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                      <FileText size={48} style={{ marginBottom: '12px' }} />
                      <p>ไม่พบประวัติการแจ้งงาน</p>
                   </div>
                )}
             </div>
           </div>
         </div>
      )}

      {/* 5. Customer Profile Modal */}
      {profileCustomer && (() => {
        const brand = getHospitalColorStyles(profileCustomer.organizations?.name);
        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            animation: 'modalFadeIn 0.3s ease'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '540px',
              background: 'var(--bg-sidebar)',
              borderRadius: '28px',
              border: `1px solid var(--border)`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.3), 0 0 40px -10px ${brand.border}`,
              animation: 'modalContentIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
              {/* Modal Header */}
              <div style={{ 
                padding: '24px 28px', 
                borderBottom: '1px solid var(--border)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                background: `linear-gradient(to bottom, ${brand.bg}, transparent)`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <UserIcon size={20} color={brand.accent} />
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>ข้อมูลโปรไฟล์ลูกค้า</h3>
                </div>
                <button 
                  onClick={() => setProfileCustomer(null)}
                  style={{ width: '36px', height: '36px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div style={{ padding: '32px 28px', overflowY: 'auto' }}>
                
                {/* 1. Avatar & Quick Info */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px', textAlign: 'center' }}>
                  <div style={{ 
                    width: '100px', 
                    height: '100px', 
                    borderRadius: '30px', 
                    background: 'var(--bg-deep)', 
                    overflow: 'hidden', 
                    border: `2px solid ${brand.accent}`,
                    boxShadow: `0 0 20px -5px ${brand.accent}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    position: 'relative'
                  }}>
                    {profileCustomer.avatar_url ? (
                       <img src={profileCustomer.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : <UserIcon size={44} color="var(--text-muted)" />}
                  </div>

                  <h4 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '4px' }}>
                    {profileCustomer.full_name || profileCustomer.display_name}
                  </h4>
                  
                  {profileCustomer.display_name && profileCustomer.full_name && (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      LINE Display: {profileCustomer.display_name}
                    </p>
                  )}

                  <span style={{ 
                     display: 'inline-flex', 
                     alignItems: 'center', 
                     gap: '6px', 
                     padding: '6px 14px', 
                     borderRadius: '10px', 
                     fontSize: '11px', 
                     fontWeight: '850', 
                     background: 'rgba(16, 185, 129, 0.1)', 
                     color: '#10b981',
                     border: '1px solid rgba(16, 185, 129, 0.2)',
                     letterSpacing: '0.5px'
                  }}>
                     <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                     CONNECTED TO LINE OA
                  </span>
                </div>

                {/* 2. Detail Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  
                  {/* Organization */}
                  <div className="glass" style={{ padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-deep)' }}>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building size={12} color={brand.accent} /> องค์กร/บริษัท
                    </p>
                    <p style={{ fontSize: '14px', fontWeight: '850', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: brand.accent, boxShadow: `0 0 10px ${brand.accent}` }} />
                      {profileCustomer.organizations?.name || 'ไม่ระบุ'}
                    </p>
                  </div>

                  {/* Department */}
                  <div className="glass" style={{ padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-deep)' }}>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={12} color="var(--primary)" /> แผนก / หน่วยงาน
                    </p>
                    <p style={{ fontSize: '14px', fontWeight: '750', color: 'var(--text-main)' }}>
                      {profileCustomer.departments?.name || 'ไม่ระบุ'}
                    </p>
                  </div>

                  {/* Position */}
                  <div className="glass" style={{ padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-deep)' }}>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserIcon size={12} color="var(--success)" /> ตำแหน่งงาน
                    </p>
                    <p style={{ fontSize: '14px', fontWeight: '750', color: 'var(--text-main)' }}>
                      {profileCustomer.positions?.name || 'ไม่ระบุ'}
                    </p>
                  </div>

                  {/* Registered Date */}
                  <div className="glass" style={{ padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-deep)' }}>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={12} color="#ff9f43" /> วันที่ลงทะเบียน
                    </p>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                      {new Date(profileCustomer.created_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                    </p>
                  </div>

                  {/* LINE Username */}
                  <div className="glass" style={{ padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-deep)', gridColumn: 'span 2' }}>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      LINE Username
                    </p>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                      {profileCustomer.line_username || 'ไม่พบบันทึก'}
                    </p>
                  </div>

                  {/* LINE User ID */}
                  <div className="glass" style={{ 
                    padding: '16px', 
                    borderRadius: '16px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg-deep)', 
                    gridColumn: 'span 2',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ flex: 1, marginRight: '12px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        LINE User ID
                      </p>
                      <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {profileCustomer.line_user_id || 'ไม่พบบันทึก'}
                      </p>
                    </div>
                    {profileCustomer.line_user_id && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(profileCustomer.line_user_id);
                          setCopiedId(true);
                          setTimeout(() => setCopiedId(false), 2000);
                        }}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          border: '1px solid var(--border)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: copiedId ? 'var(--success)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          flexShrink: 0
                        }}
                        title="Copy User ID"
                      >
                        {copiedId ? <span style={{ fontSize: '11px', fontWeight: '800' }}>✓</span> : <Copy size={16} />}
                      </button>
                    )}
                  </div>

                </div>

              </div>

              {/* Modal Footer Actions */}
              <div style={{ padding: '20px 28px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.01)' }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openHistory(profileCustomer);
                    setProfileCustomer(null);
                  }}
                  style={{
                    padding: '0 32px',
                    height: '48px',
                    borderRadius: '12px',
                    border: 'none',
                    background: brand.gradient,
                    color: '#ffffff',
                    fontWeight: '850',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: `0 4px 15px -3px ${brand.accent}`
                  }}
                >
                  <Ticket size={16} /> ประวัติการแจ้งงาน
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalContentIn { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}} />
    </div>
  );
}
