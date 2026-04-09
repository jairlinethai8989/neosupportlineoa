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
  ArrowDown
} from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try fetching with hospitals (full detail)
      const { data, error: fetchErr } = await supabase
        .from('customers')
        .select(`
          *,
          hospitals (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchErr) {
         console.warn('Initial fetch failed, trying basic fetch:', fetchErr.message);
         // Fallback: Fetch without hospitals join (might be schema issue)
         const { data: basicData, error: basicErr } = await supabase
           .from('customers')
           .select('*')
           .order('created_at', { ascending: false });
         
         if (basicErr) throw basicErr;
         setCustomers(basicData || []);
      } else {
         setCustomers(data || []);
      }
    } catch (err: any) {
      console.error('CRITICAL: Error fetching customers:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchCustomers();
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredCustomers = useMemo(() => {
    let result = customers.filter(c => {
      const name = String(c.display_name || '').toLowerCase();
      const query = searchTerm.toLowerCase();
      return name.includes(query);
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
            aValue = a.hospitals?.name || '';
            bValue = b.hospitals?.name || '';
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
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
        <p style={{ color: 'var(--text-muted)' }}>กำลังดึงข้อมูลพนักงาน (Loading Customers)...</p>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.6s ease-out' }}>
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
           <Link 
             href="/portal"
             className="glass-interactive flex-center" 
             style={{ padding: '0 20px', height: '48px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'black', fontWeight: '800', gap: '8px', textDecoration: 'none' }}
           >
              <Plus size={20} /> Add Customer (via Portal)
           </Link>
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
           { label: 'Hospital Partners', val: [...new Set(customers.map(c => c.hospital_id).filter(Boolean))].length, color: '#7367f0', icon: Building },
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
                    <tr key={c.id} className="customer-row" style={{ transition: 'all 0.3s' }}>
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
                                <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)' }}>{c.display_name}</h4>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.position || 'Registered User'}</p>
                             </div>
                          </div>
                       </td>
                       <td style={{ padding: '16px 20px', background: 'rgba(255, 255, 255, 0.02)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                             <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>{c.hospitals?.name || 'Unspecified'}</span>
                             <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.department || 'All Departments'}</span>
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
                          <Link 
                            href={`/tickets?customerId=${c.id}`}
                            className="glass-interactive flex-center" 
                            style={{ 
                              display: 'inline-flex', 
                              width: '44px', 
                              height: '44px', 
                              borderRadius: '12px', 
                              border: '1px solid var(--border)', 
                              color: 'var(--primary)',
                              marginLeft: '8px'
                            }}
                          >
                             <Ticket size={18} />
                          </Link>
                          <Link 
                            href={`/inbox?customerId=${c.id}`}
                            className="glass-interactive flex-center" 
                            style={{ 
                              display: 'inline-flex', 
                              width: '44px', 
                              height: '44px', 
                              borderRadius: '12px', 
                              border: '1px solid var(--border)', 
                              color: 'var(--text-muted)',
                              marginLeft: '8px'
                            }}
                          >
                             <ArrowRight size={18} />
                          </Link>
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
        .customer-row:hover td {
           background: rgba(255, 255, 255, 0.05) !important;
        }
        @keyframes fadeIn {
           from { opacity: 0; transform: translateY(20px); }
           to { opacity: 1; transform: translateY(0); }
         }
      `}} />
    </div>
  );
}
