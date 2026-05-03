'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';

export function TopBarClock({ locale }: { locale: 'th' | 'en' }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const formattedNow = useMemo(() => {
    const dateLocale = locale === 'th' ? 'th-TH' : 'en-US';
    const dateText = new Intl.DateTimeFormat(dateLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
    const timeText = new Intl.DateTimeFormat(dateLocale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);
    const suffix = locale === 'th' ? ' น.' : '';

    return `${dateText} • ${timeText}${suffix}`;
  }, [locale, now]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: 0,
        maxWidth: '100%',
        color: 'var(--text-muted)',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '0.01em',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <Clock size={14} color="var(--primary)" />
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {formattedNow}
      </span>
    </div>
  );
}
