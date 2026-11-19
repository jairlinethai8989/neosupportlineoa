'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Shield, 
  Mail,
  Loader2,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Search
} from 'lucide-react';
import Link from 'next/link';
import type { Profile, UserRole } from '@/types';

interface StaffProfile extends Omit<Profile, 'role'> {
  role: UserRole | 'Administrator';
  email?: string | null;
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
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
    } catch (err: unknown) {
      alert('เกิดข้อผิดพลาด: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStaff = staff.filter(s => 
    (s.full_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>พนักงาน (Staff)</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>แผนก (Dept)</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>บทบาท (Role)</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>สถานะ (Status)</th>
              <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((member) => (
              <tr key={member.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Image src={member.avatar_url || 'https://ui-avatars.com/api/?name=' + member.full_name} alt={member.full_name} width={40} height={40} style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--border)' }} />
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
                     <button style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Mail size={16} /></button>
                     <button 
                       onClick={() => handleDeleteStaff(member.id, member.full_name ?? '')}
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
