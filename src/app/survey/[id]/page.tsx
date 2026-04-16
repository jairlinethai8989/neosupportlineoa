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
  const [rating, setRating] = useState(0);
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
    if (rating === 0) {
       alert('Please provide a rating');
       return;
    }
    setSubmitting(true);
    try {
      await supabase.from('csat_surveys').update({
        score: rating,
        comment: comment,
        responded_at: new Date().toISOString()
      }).eq('ticket_id', id);

      setCompleted(true);
    } catch (err) {
      alert('Failed to submit survey');
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
     <div className="flex-center" style={{ height: '100vh', background: '#0a0e14', color: 'white', flexDirection: 'column', gap: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Survey Not Found</h1>
        <p style={{ color: 'var(--text-muted)' }}>This survey may have expired or is invalid.</p>
     </div>
  );

  if (completed) return (
     <div className="flex-center" style={{ height: '100vh', background: '#0a0e14', color: 'white', padding: '24px', textAlign: 'center' }}>
        <div className="glass" style={{ padding: '48px 32px', width: '100%', maxWidth: '400px', animation: 'fadeIn 0.5s ease-out' }}>
           <CheckCircle size={64} color="var(--success)" style={{ marginBottom: '24px' }} />
           <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '16px' }}>Thank You!</h1>
           <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Your feedback is invaluable to us. It helps us improve our service quality.
           </p>
           <button 
            onClick={() => window.close()}
            className="glass-interactive" style={{ width: '100%', marginTop: '32px', padding: '14px', borderRadius: '10px', background: 'var(--primary)', color: '#0a0e14', border: 'none', fontWeight: '800' }}>
              Done
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
            <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>Service Feedback</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
               Hi {ticket.customers?.display_name}, how was your experience with Ticket <strong>#{ticket.ticket_no}</strong>?
               {ticket.module && (
                 <span style={{ display: 'block', marginTop: '12px' }}>
                   Module: <span style={{ color: 'var(--primary)', fontWeight: '800' }}>{ticket.module}</span>
                 </span>
               )}
            </p>
         </div>

         <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '40px' }}>
               <label style={{ display: 'block', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '20px', textTransform: 'uppercase' }}>Overall Satisfaction</label>
               <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHover(star)}
                      onMouseLeave={() => setHover(0)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none', transition: 'transform 0.2s' }}
                    >
                      <Star 
                        size={40} 
                        fill={(hover || rating) >= star ? 'var(--primary)' : 'transparent'} 
                        color={(hover || rating) >= star ? 'var(--primary)' : 'var(--border)'} 
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
               </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
               <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>Additional Comments</label>
               <div style={{ position: 'relative' }}>
                  <MessageSquare style={{ position: 'absolute', left: '12px', top: '12px', color: 'rgba(255,255,255,0.2)' }} size={18} />
                  <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us what we did well or how we can improve..."
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 12px 12px 40px', color: 'white', fontSize: '15px', minHeight: '120px', outline: 'none' }}
                  />
               </div>
            </div>

            <button 
              type="submit" 
              disabled={submitting || rating === 0}
              className="glass-interactive"
              style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'var(--primary)', color: '#0a0e14', border: 'none', fontWeight: '800', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: (rating === 0 || submitting) ? 0.5 : 1 }}
            >
              {submitting ? <Loader2 className="animate-spin" /> : (
                <>
                  Submit Feedback <Send size={18} />
                </>
              )}
            </button>
         </form>

         <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Your response will help us serve you better.
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
        .animate-spin {
          animation: animate-spin 1s linear infinite;
        }
      `}} />
    </div>
  );
}
