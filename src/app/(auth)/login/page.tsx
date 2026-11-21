'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Card, CardBody, Input } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/inbox');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let finalEmail = email.trim();
      if (!finalEmail.includes('@')) {
        finalEmail = `${finalEmail}@neo.local`;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: finalEmail,
        password,
      });

      if (signInError) throw signInError;

      const params = new URLSearchParams(window.location.search);
      let finalRedirectTo = params.get('redirectTo') || '/';

      if (!params.get('redirectTo') || finalRedirectTo === '/') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, landing_page')
          .eq('id', data.user.id)
          .single();

        if (profile?.landing_page === 'inbox') {
          finalRedirectTo = '/inbox';
        } else if (profile?.landing_page === 'dashboard') {
          finalRedirectTo = '/';
        } else if (profile?.role === 'Agent') {
          finalRedirectTo = '/inbox';
        } else {
          finalRedirectTo = '/';
        }
      }

      window.location.href = finalRedirectTo;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : null;
      setError(message || 'รหัสผ่านหรือชื่อผู้ใช้ไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-canvas)',
        padding: 'var(--space-5)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <Card style={{ boxShadow: 'var(--shadow-lg)' }}>
          <CardBody style={{ padding: 'var(--space-8)' }}>
            {/* Brand Header */}
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: '0 auto var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-primary-solid)',
                  color: 'var(--color-on-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={24} aria-hidden="true" />
              </div>

              <h1
                style={{
                  fontSize: 'var(--text-xl)',
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  marginBottom: '6px',
                }}
              >
                Neo Support Intelligence
              </h1>
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                }}
              >
                ระบบบริการช่วยเหลือลูกค้า Omni-Channel
              </p>
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  background: 'var(--color-danger-soft)',
                  border: '1px solid var(--color-danger-border)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: 'var(--space-5)',
                  color: 'var(--color-danger-text)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input
                label="ชื่อผู้ใช้งาน (Username)"
                type="text"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin หรือ user@neo.local"
                leftIcon={<User size={16} aria-hidden="true" />}
              />

              <Input
                label="รหัสผ่าน (Password)"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                leftIcon={<Lock size={16} aria-hidden="true" />}
                rightAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    aria-pressed={showPassword}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                }
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                style={{ marginTop: 'var(--space-2)' }}
              >
                เข้าสู่ระบบ
              </Button>
            </form>

            <p
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
                textAlign: 'center',
                marginTop: 'var(--space-5)',
              }}
            >
              สำหรับเจ้าหน้าที่เท่านั้น หากลืมรหัสผ่านกรุณาติดต่อผู้ดูแลระบบ
            </p>

            <div
              style={{
                marginTop: 'var(--space-5)',
                paddingTop: 'var(--space-4)',
                borderTop: '1px solid var(--color-border)',
                textAlign: 'center',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-subtle)',
              }}
            >
              Powered by NeoNetwork <span className="mono" style={{ marginLeft: '6px' }}>v2.1.1</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
