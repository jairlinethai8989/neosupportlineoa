'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
import React, { useState, useEffect } from 'react';
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
  Search
} from 'lucide-react';
import Link from 'next/link';

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
    fetchStaff();
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

  const filteredStaff = staff.filter(s => 
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
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
        
        <button className="glass-interactive" style={{ 
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
        }}>
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

      <style jsx>{`
        .hover-row:hover {
          background: rgba(255,255,255,0.03);
        }
      `}</style>
    </div>
  );
}
