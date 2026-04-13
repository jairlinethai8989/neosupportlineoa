'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Shield, 
  Mail,
  MoreVertical,
  Loader2,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Send
} from 'lucide-react';
import Link from 'next/link';

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'Agent',
    department: 'ฝ่ายสนับสนุนลูกค้า (Customer Support)'
  });
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>({
    analytics: 'edit',
    inbox: 'edit',
    tickets: 'edit',
    reports: 'none',
    customers: 'edit',
    settings: 'view'
  });
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'full_name', direction: 'asc' });

  const fetchStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    
    if (error) {
      console.error('Fetch error:', error);
      alert('ไม่สามารถดึงข้อมูลพนักงานได้: ' + error.message);
    } else {
      setStaff(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchStaffAsync = async () => {
      if (!isMounted) return;
      await fetchStaff();
      
      // Fetch dynamic departments
      const { data: company } = await supabase.from('company_settings').select('departments').limit(1).single();
      if (company?.departments) {
        setDepartments(company.departments);
        setForm(prev => ({ ...prev, department: company.departments[0] || '' }));
      }
    };
    fetchStaffAsync();
    return () => { isMounted = false; };
  }, []);

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบพนักงาน ${name} ออกจากระบบ?`)) return;
    
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      alert('ลบข้อมูลไม่สำเร็จ: ' + error.message);
    } else {
      setStaff(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create staff');
      
      alert('เพิ่มพนักงานสำเร็จ! 🎉');
      setIsModalOpen(false);
      setForm({ username: '', password: '', full_name: '', role: 'Agent', department: 'ฝ่ายสนับสนุนลูกค้า (Customer Support)' });
      fetchStaff();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPermissions = (staffMember: any) => {
    setSelectedStaff(staffMember);
    setPermissions(staffMember.permissions || {
      analytics: 'view',
      inbox: 'edit',
      tickets: 'edit',
      reports: 'none',
      customers: 'view',
      settings: 'none'
    });
    setPermissionModalOpen(true);
  };

  const handleSavePermissions = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ permissions })
        .eq('id', selectedStaff.id);
      
      if (error) throw error;
      
      alert('อัปเดตสิทธิ์การใช้งานสำเร็จ! 🛡️');
      setPermissionModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      alert('ล้มเหลว: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredStaff = useMemo(() => {
    let result = staff.filter(s => 
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        switch (sortConfig.key) {
          case 'full_name':
            aValue = a.full_name;
            bValue = b.full_name;
            break;
          case 'department':
            aValue = a.department || '';
            bValue = b.department || '';
            break;
          case 'role':
            aValue = a.role;
            bValue = b.role;
            break;
          case 'status':
            aValue = a.status || '';
            bValue = b.status || '';
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
  }, [staff, searchTerm, sortConfig]);

  if (loading) return <div className="flex-center" style={{ height: '70vh' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <Link href="/" style={{ color: 'var(--text-muted)' }}><ChevronLeft size={24} /></Link>
           <div>
             <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.1' }}>จัดการพนักงาน</h1>
             <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Staff & Team Management</p>
           </div>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="glass-interactive" 
          style={{ 
            padding: '12px 24px', 
            background: 'var(--primary)', 
            color: '#0a0e14', 
            border: 'none', 
            fontWeight: '800', 
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)'
          }}
        >
          <UserPlus size={20} />
          <span>เพิ่มพนักงานใหม่</span>
        </button>
      </div>

      {/* Stats Quick View */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <div className="glass" style={{ padding: '16px 24px', flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '10px', borderRadius: '12px' }}>
            <Users size={20} color="var(--primary)" />
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>พนักงานทั้งหมด</p>
            <p style={{ fontSize: '20px', fontWeight: '800' }}>{staff.length}</p>
          </div>
        </div>
        <div className="glass" style={{ padding: '16px 24px', flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(40, 199, 111, 0.1)', padding: '10px', borderRadius: '12px' }}>
            <CheckCircle size={20} color="var(--success)" />
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>กำลังออนไลน์</p>
            <p style={{ fontSize: '20px', fontWeight: '800' }}>2</p>
          </div>
        </div>
        <div className="glass" style={{ padding: '16px 24px', flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(115, 103, 240, 0.1)', padding: '10px', borderRadius: '12px' }}>
            <Shield size={20} color="var(--secondary)" />
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ผู้ดูแลระบบ</p>
            <p style={{ fontSize: '20px', fontWeight: '800' }}>1</p>
          </div>
        </div>
      </div>

      {/* Main Content: Staff List */}
      <div className="glass" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700' }}>รายชื่อทีมงาน</h2>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="ค้นหาชื่อ หรืออีเมล..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 10px 10px 40px', color: 'white', outline: 'none', fontSize: '14px' }}
            />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              {[
                { key: 'full_name', label: 'พนักงาน (Staff)' },
                { key: 'department', label: 'แผนก (Dept)' },
                { key: 'role', label: 'บทบาท (Role)' },
                { key: 'status', label: 'สถานะ (Status)' },
                { key: 'actions', label: 'จัดการ', noSort: true, textAlign: 'right' }
              ].map(col => (
                <th 
                  key={col.key}
                  onClick={() => !col.noSort && handleSort(col.key)}
                  style={{ 
                    padding: '16px 24px', 
                    fontSize: '12px', 
                    fontWeight: '700', 
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
            {filteredStaff.map((member) => (
              <tr key={member.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={member.avatar_url} style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--border)' }} />
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '700' }}>{member.full_name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{member.email}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                   <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{member.department}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={14} color={member.role === 'Administrator' ? 'var(--primary)' : 'var(--text-muted)'} />
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>{member.role}</span>
                   </div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: member.status === 'Active' ? 'var(--success)' : member.status === 'Away' ? 'var(--warning)' : 'var(--text-muted)' 
                    }} />
                    <span style={{ fontSize: '13px' }}>{member.status}</span>
                  </div>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                     <button 
                       onClick={() => handleOpenPermissions(member)}
                       title="จัดการสิทธิ์"
                       style={{ padding: '8px', borderRadius: '8px', background: 'rgba(54, 153, 255, 0.1)', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                     >
                       <Shield size={16} />
                     </button>
                     <button style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Mail size={16} /></button>
                     <button 
                       onClick={() => handleDeleteStaff(member.id, member.full_name)}
                       style={{ padding: '8px', borderRadius: '8px', background: 'rgba(234, 84, 85, 0.1)', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                     >
                       <Trash2 size={16} />
                     </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredStaff.length === 0 && (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)' }}>ไม่พบรายชื่อพนักงานที่ค้นหา</p>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '32px', position: 'relative', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--primary)', padding: '8px', borderRadius: '10px' }}>
                   <UserPlus size={20} color="#0a0e14" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800' }}>เพิ่มพนักงานใหม่</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Username (ใช้สำหรับ Login)</label>
                <input 
                  type="text" 
                  required
                  placeholder="เช่น somchai_neo"
                  value={form.username}
                  onChange={e => setForm({...form, username: e.target.value})}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>ชื่อ-นามสกุล</label>
                <input 
                  type="text" 
                  required
                  placeholder="ส้มชาย รักดี"
                  value={form.full_name}
                  onChange={e => setForm({...form, full_name: e.target.value})}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>รหัสผ่านเริ่มต้น</label>
                <input 
                  type="password" 
                  required
                  placeholder="รหัสผ่านสำหรับพนักงาน..."
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'white' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>บทบาท (Role)</label>
                  <select 
                    value={form.role}
                    onChange={e => setForm({...form, role: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'white' }}
                  >
                    <option value="Agent">พนักงาน (Agent)</option>
                    <option value="Administrator">ผู้ดูแลระบบ (Admin)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>แผนก (Dept)</label>
                  <select 
                    value={form.department}
                    onChange={e => setForm({...form, department: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'white' }}
                  >
                    {departments.map((dept, idx) => (
                      <option key={idx} value={dept}>{dept}</option>
                    ))}
                    {departments.length === 0 && <option value="">ยังไม่มีแผนก</option>}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '14px', borderRadius: '10px', background: 'transparent', border: '1px solid var(--border)', color: 'white', cursor: 'pointer' }}>ยกเลิก</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  style={{ flex: 1, padding: '14px', borderRadius: '10px', background: 'var(--primary)', border: 'none', color: '#0a0e14', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> ยืนยันเพิ่มพนักงาน</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {permissionModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(10px)' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '600px', padding: '32px', position: 'relative', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(54, 153, 255, 0.1)', padding: '10px', borderRadius: '12px' }}>
                   <Shield size={24} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: '800' }}>กำหนดสิทธิ์การเข้าถึง</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{selectedStaff?.full_name} ({selectedStaff?.role})</p>
                </div>
              </div>
              <button 
                onClick={() => setPermissionModalOpen(false)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <XCircle size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {[
                { key: 'analytics', label: 'ภาพรวม & สถิติ (Analytics)', icon: CheckCircle },
                { key: 'inbox', label: 'ระบบแชท (Inbox)', icon: Mail },
                { key: 'tickets', label: 'จัดการตั๋ว (Tickets)', icon: Shield },
                { key: 'reports', label: 'การส่งรายงาน (LINE Reports)', icon: Send },
                { key: 'customers', label: 'ฐานข้อมูลลูกค้า (Customers)', icon: Users },
                { key: 'settings', label: 'ตั้งค่าระบบ (Settings)', icon: Shield },
              ].map((module) => (
                <div key={module.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <module.icon size={18} color="var(--text-muted)" />
                    <span style={{ fontSize: '14px', fontWeight: '700' }}>{module.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px' }}>
                    {['none', 'view', 'edit'].map((level) => (
                      <button
                        key={level}
                        onClick={() => setPermissions({ ...permissions, [module.key]: level })}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: '800',
                          border: 'none',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          background: permissions[module.key] === level 
                            ? (level === 'edit' ? 'var(--primary)' : level === 'view' ? 'var(--secondary)' : 'var(--danger)') 
                            : 'transparent',
                          color: permissions[module.key] === level ? '#0a0e14' : 'var(--text-dim)',
                          transition: 'all 0.2s'
                        }}
                      >
                        {level === 'none' ? 'OFF' : level === 'view' ? 'VIEW' : 'EDIT'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setPermissionModalOpen(false)} style={{ flex: 1, padding: '16px', borderRadius: '14px', background: 'transparent', border: '1px solid var(--border)', color: 'white', fontWeight: '700', cursor: 'pointer' }}>ยกเลิก</button>
              <button 
                onClick={handleSavePermissions}
                disabled={submitting}
                className="glass-interactive"
                style={{ flex: 1, padding: '16px', borderRadius: '14px', background: 'var(--primary)', border: 'none', color: '#0a0e14', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {submitting ? <Loader2 size={20} className="animate-spin" /> : 'บันทึกสิทธิ์พนักงาน'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .hover-row:hover {
          background: rgba(255,255,255,0.03);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
