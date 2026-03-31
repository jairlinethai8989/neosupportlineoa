'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      
      // Successfully logged in
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, rgba(115, 103, 240, 0.1), transparent), radial-gradient(circle at bottom left, rgba(0, 242, 254, 0.1), transparent)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative Blobs */}
      <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', borderRadius: '50%', background: 'var(--primary)', filter: 'blur(100px)', opacity: 0.1, zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '-100px', left: '-100px', width: '300px', height: '300px', borderRadius: '50%', background: 'var(--secondary)', filter: 'blur(100px)', opacity: 0.1, zIndex: 0 }} />

      <div className="glass" style={{ 
        width: '100%', 
        maxWidth: '420px', 
        padding: '48px', 
        position: 'relative', 
        zIndex: 1,
        animation: 'fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ 
            background: 'var(--primary)', 
            width: '48px', 
            height: '48px', 
            borderRadius: '12px',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0, 242, 254, 0.4)'
          }}>
            <ShieldCheck color="#0a0e14" size={28} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>Welcome Back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Sign in to continue to Agent Portal</p>
        </div>

        {error && (
          <div className="flex-center" style={{ 
            background: 'rgba(234, 84, 85, 0.1)', 
            border: '1px solid rgba(234, 84, 85, 0.2)',
            padding: '12px',
            borderRadius: '8px',
            gap: '10px',
            marginBottom: '24px',
            color: 'var(--danger)',
            fontSize: '13px'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@neosupport.com"
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '14px 14px 14px 48px',
                  color: 'white',
                  fontSize: '15px'
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
              <a href="#" style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>Forgot?</a>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '14px 14px 14px 48px',
                  color: 'white',
                  fontSize: '15px'
                }}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="glass-interactive"
            style={{
              width: '100%',
              background: 'var(--primary)',
              color: '#0a0e14',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginTop: '8px',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                Sign In
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '14px', color: 'var(--text-muted)' }}>
          Don't have an account? <a href="#" style={{ color: 'var(--primary)', fontWeight: '600' }}>Contact Admin</a>
        </p>
      </div>

      <style jsx global>{`
        @keyframes animate-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: animate-spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
