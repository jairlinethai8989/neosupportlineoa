'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Star, 
  Send, 
  CheckCircle, 
  ShieldCheck, 
  MessageSquare,
  Loader2
} from 'lucide-react';

export default function SurveyPage() {
  const { id } = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    async function fetchTicket() {
      const { data } = await supabase
        .from('tickets')
        .select('*, customers(display_name)')
        .eq('id', id)
        .single();
      if (data) setTicket(data);
      setLoading(false);
    }
    if (id) fetchTicket();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score === 0) {
       alert('กรุณาให้คะแนนความพึงพอใจ');
       return;
    }
    setSubmitting(true);
    try {
      // Use upsert to handle cases where the survey record doesn't exist yet
      const { error } = await supabase.from('csat_surveys').upsert({
        ticket_id: id,
        score: score,
        comment: comment,
        responded_at: new Date().toISOString()
      }, { onConflict: 'ticket_id' });

      if (error) {
        console.error('Supabase Error:', error);
        alert(`เกิดข้อผิดพลาดจากฐานข้อมูล: ${error.message} (${error.code})`);
        return;
      }
      setCompleted(true);
    } catch (err: any) {
      console.error('Survey error:', err);
      alert(`ไม่สามารถบันทึกข้อมูลได้: ${err.message || 'ปัญหาการเชื่อมต่อ'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
     <div className="flex-center" style={{ height: '100vh', background: '#0a0e14', color: 'white' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
     </div>
  );

  if (!ticket) return (
     <div className="flex-center" style={{ height: '100vh', background: '#0a0e14', color: 'white', padding: '24px', textAlign: 'center', flexDirection: 'column', gap: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>ไม่พบข้อมูลการประเมิน</h1>
        <p style={{ color: 'var(--text-muted)' }}>ลิงก์นี้อาจจะไม่ถูกต้อง หรือใบงานนี้ไม่สามารถประเมินได้แล้ว</p>
     </div>
  );

  if (completed) return (
     <div className="flex-center" style={{ height: '100vh', background: '#0a0e14', color: 'white', padding: '24px', textAlign: 'center' }}>
        <div className="glass" style={{ padding: '48px 32px', width: '100%', maxWidth: '400px', animation: 'fadeIn 0.5s ease-out' }}>
           <CheckCircle size={64} color="var(--success)" style={{ marginBottom: '24px' }} />
           <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '16px' }}>ขอบคุณครับ!</h1>
           <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
              ความคิดเห็นของคุณมีค่าสำหรับเรามาก เพื่อนำไปปรับปรุงการบริการให้ดียิ่งขึ้นครับ
           </p>
           <button 
            onClick={() => window.close()}
            className="glass-interactive" style={{ width: '100%', marginTop: '32px', padding: '14px', borderRadius: '10px', background: 'var(--primary)', color: '#0a0e14', border: 'none', fontWeight: '800' }}>
              เรียบร้อย
           </button>
        </div>
     </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e14', color: 'white', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
         <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
               <div style={{ background: 'var(--primary)', padding: '12px', borderRadius: '12px', boxShadow: '0 0 20px rgba(0, 242, 254, 0.3)' }}>
                  <ShieldCheck size={32} color="#0a0e14" />
               </div>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>ประเมินการบริการ</h1>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
               คุณ {ticket.customers?.display_name} <br/>
               ช่วยให้คะแนนการแก้ไขงานหมายเลข <strong>#{ticket.ticket_no}</strong>
               {ticket.module && (
                 <div style={{ marginTop: '12px' }}>
                   ระบบที่เกี่ยวข้อง: <span style={{ color: 'var(--primary)', fontWeight: '800' }}>{ticket.module}</span>
                 </div>
               )}
            </div>
         </div>

         <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '40px' }}>
               <label style={{ display: 'block', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '20px', textTransform: 'uppercase' }}>ความพึงพอใจในภาพรวม</label>
               <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setScore(star)}
                      onMouseEnter={() => setHover(star)}
                      onMouseLeave={() => setHover(0)}
                      className="star-button"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none', transition: 'transform 0.2s', padding: '4px' }}
                    >
                      <Star 
                        size={44} 
                        fill={(hover || score) >= star ? 'var(--primary)' : 'transparent'} 
                        color={(hover || score) >= star ? 'var(--primary)' : 'rgba(255,255,255,0.1)'} 
                        strokeWidth={1.5}
                        style={{ filter: (hover || score) >= star ? 'drop-shadow(0 0 8px rgba(0, 242, 254, 0.5))' : 'none' }}
                      />
                    </button>
                  ))}
               </div>
               <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>
                  {score === 5 ? 'ยอดเยี่ยมที่สุด' : score === 4 ? 'ดีมาก' : score === 3 ? 'ดี' : score === 2 ? 'พอใช้' : score === 1 ? 'ควรปรับปรุง' : 'กรุณาเลือกคะแนน'}
               </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
               <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>ข้อเสนอแนะเพิ่มเติม (ถ้ามี)</label>
               <div style={{ position: 'relative' }}>
                  <MessageSquare style={{ position: 'absolute', left: '12px', top: '12px', color: 'rgba(255,255,255,0.2)' }} size={18} />
                  <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="บอกเราได้ครับว่าชอบส่วนไหน หรืออยากให้เราปรับปรุงอะไร..."
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 12px 12px 40px', color: 'white', fontSize: '15px', minHeight: '120px', outline: 'none' }}
                  />
               </div>
            </div>

            <button 
              type="submit" 
              disabled={submitting || score === 0}
              className="glass-interactive"
              style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'var(--primary)', color: '#0a0e14', border: 'none', fontWeight: '800', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: (score === 0 || submitting) ? 0.5 : 1 }}
            >
              {submitting ? <Loader2 className="animate-spin" /> : (
                <>
                  ส่งแบบประเมิน <Send size={18} />
                </>
              )}
            </button>
         </form>

         <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '12px', color: 'var(--text-muted)' }}>
            ข้อมูลของคุณจะถูกนำไปพัฒนาการบริการให้ดียิ่งขึ้น
         </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes animate-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .animate-spin {
          animation: animate-spin 1s linear infinite;
        }
        .star-button:hover {
          transform: scale(1.2) rotate(5deg);
        }
        .star-button:active {
          transform: scale(0.9);
        }
        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
        }
        .glass-interactive {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .glass-interactive:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 242, 254, 0.3);
        }
        .glass-interactive:active:not(:disabled) {
          transform: translateY(0);
        }
      `}} />
    </div>
  );
}
