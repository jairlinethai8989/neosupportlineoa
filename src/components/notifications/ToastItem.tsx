import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, AlertTriangle, Ticket, MessageSquare, Clock } from 'lucide-react';
import { ToastNotif, NotifType } from '@/hooks/useNotifications';

interface ToastItemProps {
  toast: ToastNotif;
  onDismiss: (id: string) => void;
  duration?: number;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  sla: {
    icon: AlertTriangle,
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    label: 'SLA หลุดกำหนด',
  },
  sla_warning: {
    icon: Clock,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    label: 'SLA ใกล้หมด',
  },
  ticket: {
    icon: Ticket,
    color: '#3699FF',
    bg: 'rgba(54, 153, 255, 0.12)',
    label: 'ใบงาน',
  },
  message: {
    icon: MessageSquare,
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.12)',
    label: 'ข้อความ',
  },
};

export default function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const router = useRouter();
  // SLA toasts stay longer by default
  const effectiveDuration = toast.duration ?? (toast.type === 'sla' ? 8000 : toast.type === 'sla_warning' ? 6000 : 5000);

  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);

  const cfg = TYPE_CONFIG[toast.type] ?? TYPE_CONFIG.ticket;
  const Icon = cfg.icon;

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  // Progress countdown
  useEffect(() => {
    const step = 100 / (effectiveDuration / 100);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) { clearInterval(interval); handleDismiss(); return 0; }
        return prev - step;
      });
    }, 100);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDuration]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const handleClick = () => {
    if (toast.type === 'ticket' || toast.type === 'sla' || toast.type === 'sla_warning') {
      if (toast.ticketId) router.push(`/tickets/${toast.ticketId}`);
      else router.push('/tickets');
    } else if (toast.type === 'message') {
      router.push('/inbox');
    }
    handleDismiss();
  };

  return (
    <div
      style={{
        width: '340px',
        background: 'var(--bg-card)',
        border: `1px solid ${cfg.color}30`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: '16px',
        backdropFilter: 'blur(34px)',
        boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px var(--border), 0 0 20px ${cfg.color}15`,
        overflow: 'hidden',
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={handleClick}
      role="alert"
      aria-live="assertive"
    >
      {/* Glow accent for SLA alerts */}
      {(toast.type === 'sla' || toast.type === 'sla_warning') && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
          opacity: 0.6,
        }} />
      )}

      {/* Content */}
      <div style={{ padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* Icon */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: cfg.bg,
            border: `1px solid ${cfg.color}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={16} color={cfg.color} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span
              style={{
                fontSize: '9px',
                fontWeight: '900',
                color: cfg.color,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {cfg.label}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                color: 'var(--text-muted)',
                opacity: 0.6,
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          </div>
          <p
            style={{
              fontSize: '13px',
              fontWeight: '700',
              marginTop: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--text-main)',
            }}
          >
            {toast.title}
          </p>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {toast.body}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: '2px',
          background: `${cfg.color}20`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${progress}%`,
            background: cfg.color,
            transition: 'width 0.1s linear',
          }}
        />
      </div>
    </div>
  );
}
