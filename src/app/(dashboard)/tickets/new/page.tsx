'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Ticket, 
  User, 
  Search, 
  Loader2, 
  AlertCircle, 
  SendHorizontal, 
  ShieldCheck,
  Building,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function CreateInternalTicketPage() {
  const router = useRouter();
  
  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  
  // UI State
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [staffProfile, setStaffProfile] = useState<any>(null);

  useEffect(() => {
    async function init() {
      // 1. Get Current Staff Profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setStaffProfile(p);
      }

      // 2. Fetch Customers for Selection
      const { data, error: fetchErr } = await supabase
        .from('customers')
        .select('id, display_name, hospitals(name, abbreviation)')
        .order('display_name', { ascending: true });
      
      if (!fetchErr) {
        setCustomers(data || []);
      }
      setLoadingCustomers(false);
    }
    init();
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.hospitals?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setError('กรุณาเลือกชื่อลูกค้า (Please select a customer)');
      return;
    }
    if (!subject.trim()) {
      setError('กรุณาระบุหัวข้อเรื่อง (Please enter a subject)');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (!customer) throw new Error('Customer not found');

      // 1. Create Internal Ticket
      // Use "👷‍♂️ [Internal/Private]" prefix for "สั่งส่วนตัว" feel and easy tracking
      const finalSubject = `👷‍♂️ [Private] ${subject}`;
      
      const ticketPayload = {
        customer_id: selectedCustomerId,
        hospital_id: customer.hospital_id || null, // Might need to fetch full customer data if not in selection
        subject: finalSubject,
        description: description || subject,
        status: 'New',
        priority: priority,
        assigned_agent_id: staffProfile?.id, // Auto-assign to the creator as it's a private order
        created_at: new Date().toISOString()
      };

      const { data: newTicket, error: ticketError } = await supabase
        .from('tickets')
        .insert([ticketPayload])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // 2. Initialize Conversation if needed 
      // (Optional: Internal tickets might not need the same chat flow, but let's keep it consistent)
      const { data: newConv } = await supabase.from('conversations').insert([{
        customer_id: selectedCustomerId,
        status: 'active',
        current_ticket_id: newTicket.id,
        last_message_at: new Date().toISOString()
      }]).select().single();

      // 3. Log the action
      await supabase.from('ticket_logs').insert([{
        ticket_id: newTicket.id,
        action_type: 'create',
        performer_id: staffProfile?.id,
        note: `Internal Ticket created by ${staffProfile?.full_name}`
      }]);

      // 4. Send Notification
      try {
        const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
        await sendLineGroupNotification(`👷‍♂️ [สร้างงานภายใน] ${staffProfile?.full_name} ได้สร้างใบงานส่วนตัวสำหรับลูกค้า ${customer.display_name}\nเรื่อง: ${subject}`);
      } catch { }

      router.push(`/tickets/${newTicket.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <Link href="/tickets" className="glass-interactive flex-center" style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text-main)' }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-1px' }}>สร้างใบงานใหม่ (เจ้าหน้าที่)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>การสร้างใบงานแทนลูกค้า (Internal / Private Ticket)</p>
        </div>
      </div>

      <div className="glass" style={{ padding: '32px', borderRadius: '24px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {error && (
            <div className="flex" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(234, 84, 85, 0.1)', color: '#ea5455', border: '1px solid rgba(234, 84, 85, 0.2)', gap: '12px', alignItems: 'center' }}>
              <AlertCircle size={20} />
              <span style={{ fontSize: '14px', fontWeight: '700' }}>{error}</span>
            </div>
          )}

          {/* 1. Customer Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>เลือกชื่อลูกค้า (Select Customer)</label>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} size={18} />
              <input 
                type="text" 
                placeholder="พิมพ์ชื่อเพื่อค้นหา..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ 
                  width: '100%', 
                  background: 'rgba(255, 255, 255, 0.03)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '16px', 
                  padding: '16px 16px 16px 48px', 
                  color: 'var(--text-main)',
                  outline: 'none',
                  fontSize: '15px'
                }}
              />
            </div>
            
            {loadingCustomers ? (
              <div className="flex-center" style={{ padding: '20px' }}><Loader2 className="animate-spin" size={20} color="var(--primary)" /></div>
            ) : (
              <div className="no-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '16px', background: 'rgba(0,0,0,0.1)' }}>
                {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => { setSelectedCustomerId(c.id); setSearchTerm(c.display_name); }}
                    style={{ 
                      padding: '12px 16px', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: selectedCustomerId === c.id ? 'rgba(54, 153, 255, 0.1)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <User size={16} style={{ color: selectedCustomerId === c.id ? 'var(--primary)' : 'var(--text-muted)' }} />
                      <span style={{ fontSize: '14px', fontWeight: selectedCustomerId === c.id ? '800' : '600' }}>{c.display_name}</span>
                    </div>
                    {c.hospitals?.name && <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>{c.hospitals.name}</span>}
                  </div>
                )) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>ไม่พบรายชื่อลูกค้ายืนยันแล้ว</div>
                )}
              </div>
            )}
          </div>

          {/* 2. Subject */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>หัวข้อ (Subject)</label>
            <input 
              type="text" 
              placeholder="สรุปสั้นๆ เช่น ตรวจสอบระบบด่วน, สั่งสินค้าเพิ่มเติม..." 
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '15px', outline: 'none' }}
            />
          </div>

          {/* 3. Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>รายละเอียด (Description)</label>
            <textarea 
              placeholder="ระบุรายละเอียดที่ทางลูกค้าแจ้งมาเป็นพิเศษ..." 
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ height: '150px', padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '15px', outline: 'none', resize: 'none' }}
            />
          </div>

          {/* 4. Priority */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>ความสำคัญ (Priority)</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['Low', 'Medium', 'High', 'Critical'].map(p => (
                <button 
                  key={p} 
                  type="button" 
                  onClick={() => setPriority(p)}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border)', 
                    background: priority === p ? 'var(--primary)' : 'transparent', 
                    color: priority === p ? 'black' : 'var(--text-muted)', 
                    fontWeight: priority === p ? '900' : '600', 
                    fontSize: '12px',
                    transition: 'all 0.2s'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button 
            type="submit" 
            disabled={submitting}
            className="glass-interactive"
            style={{ 
              marginTop: '12px', 
              padding: '20px', 
              borderRadius: '20px', 
              background: 'var(--primary)', 
              color: 'black', 
              fontWeight: '900', 
              fontSize: '17px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '12px',
              border: 'none',
              opacity: submitting ? 0.7 : 1
            }}
          >
            {submitting ? <Loader2 className="animate-spin" size={24} /> : (
              <>
                <ShieldCheck size={24} /> ยืนยันสร้างใบงาน (Create Ticket)
              </>
            )}
          </button>
        </form>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
