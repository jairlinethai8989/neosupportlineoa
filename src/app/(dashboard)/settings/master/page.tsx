'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, 
  Users, 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X,
  Loader2,
  Search,
  ChevronRight
} from 'lucide-react';

type Tab = 'hospitals' | 'departments' | 'positions';

export default function MasterSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('hospitals');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    let table = '';
    if (activeTab === 'hospitals') table = 'hospitals';
    else if (activeTab === 'departments') table = 'departments';
    else if (activeTab === 'positions') table = 'positions';

    const { data } = await supabase
      .from(table)
      .select('*')
      .order('name');
    
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    setIsAdding(false);
    setEditingId(null);
  }, [activeTab]);

  const handleAdd = async () => {
    if (!newItemName.trim()) return;
    setSubmitting(true);
    let table = activeTab;
    const { error } = await supabase.from(table).insert([{ name: newItemName, is_active: true }]);
    if (!error) {
      setNewItemName('');
      setIsAdding(false);
      fetchData();
    }
    setSubmitting(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editItemName.trim()) return;
    setSubmitting(true);
    let table = activeTab;
    const { error } = await supabase.from(table).update({ name: editItemName }).eq('id', id);
    if (!error) {
      setEditingId(null);
      fetchData();
    }
    setSubmitting(false);
  };

  const toggleStatus = async (id: string, current: boolean) => {
    let table = activeTab;
    await supabase.from(table).update({ is_active: !current }).eq('id', id);
    fetchData();
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  const TAB_CONFIG = {
    hospitals: { title: 'โรงพยาบาล / หน่วยงาน', icon: Building2, desc: 'จัดการรายชื่อสถานพยาบาลที่รองรับในระบบ' },
    departments: { title: 'แผนก / ฝ่าย', icon: Users, desc: 'จัดการรายชื่อแผนกภายในองค์กร' },
    positions: { title: 'ตำแหน่งงาน', icon: Briefcase, desc: 'จัดการชื่อตำแหน่งสำหรับผู้แจ้งล่วงหน้า' }
  };

  const ActiveIcon = TAB_CONFIG[activeTab].icon;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
         <h1 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ActiveIcon size={32} color="var(--primary)" />
            ตั้งค่าข้อมูลพื้นฐาน
         </h1>
         <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>{TAB_CONFIG[activeTab].desc}</p>
      </div>

      {/* Tabs Selector */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '16px', border: '1px solid var(--border)', width: 'fit-content' }}>
        {(['hospitals', 'departments', 'positions'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: '800',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === t ? 'var(--primary)' : 'transparent',
              color: activeTab === t ? 'black' : 'var(--text-muted)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
             {React.createElement(TAB_CONFIG[t].icon, { size: 16 })}
             {TAB_CONFIG[t].title.split(' / ')[0]}
          </button>
        ))}
      </div>

      {/* Main Content Card */}
      <div className="glass" style={{ borderRadius: '24px', overflow: 'hidden' }}>
         {/* List Toolbar */}
         <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
               <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
               <input 
                 type="text" 
                 placeholder={`ค้นหา${TAB_CONFIG[activeTab].title.split(' / ')[0]}...`}
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px 12px 48px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
               />
            </div>

            <button 
              onClick={() => setIsAdding(true)}
              style={{ background: 'var(--primary)', color: 'black', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
               <Plus size={18} /> เพิ่มรายการใหม่
            </button>
         </div>

         {/* Add Form (Expandable) */}
         {isAdding && (
           <div style={{ padding: '24px', background: 'rgba(0, 242, 254, 0.03)', borderBottom: '1px solid var(--border)', animation: 'slideInRight 0.3s ease-out' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                 <input 
                   autoFocus
                   type="text" 
                   placeholder={`ระบุชื่อ${TAB_CONFIG[activeTab].title.split(' / ')[0]}...`}
                   value={newItemName}
                   onChange={e => setNewItemName(e.target.value)}
                   style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '14px 20px', color: 'var(--text-main)', fontSize: '15px', outline: 'none' }}
                   onKeyDown={e => e.key === 'Enter' && handleAdd()}
                 />
                 <button onClick={handleAdd} disabled={submitting} style={{ background: 'var(--primary)', border: 'none', width: '48px', height: '48px', borderRadius: '12px', cursor: 'pointer', color: 'black' }} className="flex-center">
                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={24} />}
                 </button>
                 <button onClick={() => setIsAdding(false)} style={{ background: 'rgba(234, 84, 85, 0.1)', border: 'none', width: '48px', height: '48px', borderRadius: '12px', cursor: 'pointer', color: 'var(--danger)' }} className="flex-center">
                    <X size={24} />
                 </button>
              </div>
           </div>
         )}

         {/* Items List */}
         <div style={{ minHeight: '300px' }}>
            {loading ? (
              <div className="flex-center" style={{ height: '300px', flexDirection: 'column', gap: '16px' }}>
                 <Loader2 className="animate-spin" color="var(--primary)" size={40} />
                 <p style={{ color: 'var(--text-muted)' }}>กำลังดึงข้อมูล...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex-center" style={{ height: '300px', flexDirection: 'column', gap: '16px', opacity: 0.5 }}>
                 <ActiveIcon size={48} />
                 <p>ไม่พบรายการที่ต้องการ</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                 {filteredItems.map(item => (
                   <div key={item.id} style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.2s' }} className="hover-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                         <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ActiveIcon size={18} color={item.is_active ? 'var(--primary)' : 'var(--text-muted)'} />
                         </div>
                         
                         {editingId === item.id ? (
                           <input 
                             autoFocus
                             type="text" 
                             value={editItemName}
                             onChange={e => setEditItemName(e.target.value)}
                             style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid var(--primary)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '700', outline: 'none', width: '250px' }}
                             onKeyDown={e => e.key === 'Enter' && handleUpdate(item.id)}
                           />
                         ) : (
                           <div>
                              <p style={{ fontSize: '15px', fontWeight: '700', color: item.is_active ? 'var(--text-main)' : 'var(--text-muted)' }}>{item.name}</p>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>ID: {item.id.slice(0,8)}</span>
                           </div>
                         )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         {/* Status Badge */}
                         <button 
                           onClick={() => toggleStatus(item.id, item.is_active)}
                           style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: '800', background: item.is_active ? 'rgba(40, 199, 111, 0.1)' : 'rgba(255,255,255,0.05)', color: item.is_active ? 'var(--success)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', marginRight: '16px' }}
                         >
                            {item.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                         </button>

                         {/* Actions */}
                         {editingId === item.id ? (
                           <>
                              <button onClick={() => handleUpdate(item.id)} style={{ color: 'var(--primary)' }} className="glass-interactive p-2 rounded-lg">
                                 <Check size={18} />
                              </button>
                              <button onClick={() => setEditingId(null)} style={{ color: 'var(--text-muted)' }} className="glass-interactive p-2 rounded-lg">
                                 <X size={18} />
                              </button>
                           </>
                         ) : (
                           <>
                              <button 
                                onClick={() => {
                                  setEditingId(item.id);
                                  setEditItemName(item.name);
                                }}
                                style={{ color: 'white', opacity: 0.5 }} className="glass-interactive p-2 rounded-lg"
                              >
                                 <Edit3 size={18} />
                              </button>
                           </>
                         )}
                      </div>
                   </div>
                 ))}
              </div>
            )}
         </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .hover-item:hover { background: rgba(255,255,255,0.015); }
        .p-2 { padding: 8px; }
      `}} />
    </div>
  );
}
