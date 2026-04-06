import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, AlertTriangle, Ticket, MessageSquare } from 'lucide-react';
import { ToastNotif, NotifType } from '@/hooks/useNotifications';

interface ToastItemProps {
  toast: ToastNotif;
  onDismiss: (id: string) => void;
  duration?: number;
}

const TYPE_CONFIG: Record<NotifType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  sla: {
    icon: AlertTriangle,
    color: '#ff9f43',
    bg: 'rgba(255, 159, 67, 0.12)',
    label: 'SLA Alert',
  },
  ticket: {
    icon: Ticket,
    color: '#00f2fe',
    bg: 'rgba(0, 242, 254, 0.10)',
    label: 'ใบงาน',
  },
  message: {
    icon: MessageSquare,
    color: '#28c76f',
    bg: 'rgba(40, 199, 111, 0.10)',
    label: 'ข้อความ',
  },
};

export default function ToastItem({ toast, onDismiss, duration = 5000 }: ToastItemProps) {
  const router = useRouter();
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);

  const cfg = TYPE_CONFIG[toast.type];
  const Icon = cfg.icon;

  // Entrance animation
  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(enterTimer);
  }, []);

  // Progress countdown
  useEffect(() => {
    const step = 100 / (duration / 100);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          handleDismiss();
          return 0;
        }
        return prev - step;
      });
    }, 100);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const handleClick = () => {
    if (toast.type === 'ticket' || toast.type === 'sla') {
      if (toast.ticketId) router.push(`/tickets/${toast.ticketId}`);
    } else if (toast.type === 'message') {
      router.push('/inbox');
    }
    handleDismiss();
  };

  return (
    <div
      style={{
        width: '340px',
        background: 'rgba(10, 14, 20, 0.96)',
        border: `1px solid ${cfg.color}30`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: '12px',
        backdropFilter: 'blur(20px)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)`,
        overflow: 'hidden',
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={handleClick}
    >
      {/* Content */}
      <div style={{ padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* Icon */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: cfg.bg,
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
                fontWeight: '800',
                color: cfg.color,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
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
