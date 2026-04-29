'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Send, 
  Eye, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  ChevronRight,
  ShieldCheck,
  Zap,
  BarChart2
} from 'lucide-react';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useAppContext } from '@/contexts/AppContext';

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatPreviewDate(ymd: string, locale: 'th' | 'en'): string {
  const date = new Date(`${ymd}T00:00:00`);
  const intlLocale = locale === 'th' ? 'th-TH' : 'en-US';
  return new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

type PreviewResponse = {
  total: number;
  newProgress: number;
  resolved: number;
  hospitalGroups: Record<string, number>;
};

export default function ReportsPage() {
  const { t, locale } = useStaffLocale();
  const { userProfile } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(() => toYmd(new Date()));
  const [preview, setPreview] = useState<PreviewResponse>({
    total: 0,
    newProgress: 0,
    resolved: 0,
    hospitalGroups: {},
  });

  const canSend = useMemo(() => {
    if (userProfile?.role === 'Administrator') return true;
    return userProfile?.permissions?.reports === 'edit';
  }, [userProfile]);

  const previewDateLabel = useMemo(() => formatPreviewDate(targetDate, locale), [locale, targetDate]);
  const ticketUnitLabel = useMemo(() => t('tickets.unit'), [t]);

  // Fetch preview data
  const fetchPreview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/hub/preview?date=${targetDate}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Preview API failed (${res.status})`);
      }
      const data = (await res.json()) as PreviewResponse;
      setPreview({
        total: data.total || 0,
        newProgress: data.newProgress || 0,
        resolved: data.resolved || 0,
        hospitalGroups: data.hospitalGroups || {},
      });
    } catch (e) {
      console.error(e);
      setPreview({
        total: 0,
        newProgress: 0,
        resolved: 0,
        hospitalGroups: {},
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [targetDate]);

  // Grouping for preview
  const groupedData = useMemo(() => {
    const normalizedHospitalGroups: Record<string, number> = {};
    for (const [name, count] of Object.entries(preview.hospitalGroups || {})) {
      normalizedHospitalGroups[name || t('reports.unspecifiedHospital')] = count;
    }
    return {
      total: preview.total,
      newProgress: preview.newProgress,
      resolved: preview.resolved,
      hospitalGroups: normalizedHospitalGroups,
    };
  }, [preview, t]);

  const handleSendReport = async (set: string) => {
    const reportName = set === '1' ? t('reports.set1Title') : t('reports.set2Title');
    
    if (!window.confirm(`${t('common.messages.confirmAction')}: ${reportName} ?`)) return;

    setSending(set);
    try {
      const res = await fetch(`/api/cron/daily-summary?key=NEO_CRON_2026&set=${set}&date=${targetDate}`);
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${t('common.messages.success')}: "${reportName}"`);
      } else {
        alert(`❌ ${t('common.messages.error')}: ${data.error || 'Unknown Error'}`);
      }
    } catch (e) {
      alert(`❌ ${t('common.messages.error')}`);
    } finally {
      setSending(null);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out', maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
           <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
             <ShieldCheck color="var(--primary)" size={32} />
             {t('reports.hubTitle')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
             LINE REPORTING HUB • PREVIEW & BROADCAST
          </p>
        </div>
        
        <div className="glass" style={{ padding: '8px 16px', borderRadius: '14px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Calendar size={18} color="var(--primary)" />
          <input 
            type="date" 
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--text-main)', 
              fontSize: '14px', fontWeight: '700', outline: 'none', cursor: 'pointer' 
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '24px' }}>
        {/* Left Column: Preview Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Summary Stats Card */}
          <div className="glass-premium" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
               <BarChart2 size={120} color="var(--primary)" />
            </div>
             <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Eye size={18} color="var(--primary)" />
               {t('reports.previewFor')}: {previewDateLabel}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{t('dashboard.tabs.all')}</p>
                  <p style={{ fontSize: '24px', fontWeight: '900' }}>{loading ? '...' : groupedData.total}</p>
               </div>
                <div style={{ background: 'rgba(0, 242, 254, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid var(--primary)' }}>
                  <p style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase' }}>{t('dashboard.inProgress')}</p>
                  <p style={{ fontSize: '24px', fontWeight: '900', color: 'var(--primary)' }}>{loading ? '...' : groupedData.newProgress}</p>
               </div>
                <div style={{ background: 'rgba(40, 199, 111, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid var(--success)' }}>
                  <p style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '700', textTransform: 'uppercase' }}>{t('dashboard.resolved')}</p>
                  <p style={{ fontSize: '24px', fontWeight: '900', color: 'var(--success)' }}>{loading ? '...' : groupedData.resolved}</p>
               </div>
            </div>
          </div>

          {/* Detailed Hospital Grouping Preview */}
          <div className="glass" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '800' }}>{t('reports.hospitalGrouping')}</h3>
                {loading && <Zap size={16} className="animate-pulse" color="var(--primary)" />}
              </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 {Object.entries(groupedData.hospitalGroups).length === 0 && !loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                     <Zap size={32} style={{ opacity: 0.1, marginBottom: '12px' }} />
                     <p>{t('reports.noDataRange')}</p>
                  </div>
                ) : Object.entries(groupedData.hospitalGroups).map(([name, count]) => (
                   <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{name}</span>
                       <span style={{ fontSize: '12px', fontWeight: '800', background: 'var(--primary)', color: 'black', padding: '2px 10px', borderRadius: '20px' }}>
                        {count} {ticketUnitLabel}
                      </span>
                   </div>
                ))}
             </div>
          </div>
        </div>

        {/* Right Column: Control Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-premium" style={{ padding: '24px', border: '1px solid #FBC02D' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <FileText color="#FBC02D" size={24} />
                <h4 style={{ fontWeight: '800', fontSize: '15px' }}>REPORT SET 1</h4>
             </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                {t('reports.set1Desc')}
             </p>
              <button 
                disabled={sending !== null || groupedData.total === 0 || loading || !canSend}
                onClick={() => handleSendReport('1')}
                className="glass-interactive"
                style={{ 
                  width: '100%', padding: '14px', borderRadius: '12px', 
                  background: !canSend ? 'rgba(255,255,255,0.05)' : (sending === '1' ? 'var(--bg-card)' : '#FBC02D'), 
                  color: !canSend ? 'var(--text-muted)' : 'black', fontWeight: '900', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  opacity: (groupedData.total === 0 || loading) ? 0.5 : 1
                }}
             >
                {sending === '1' ? t('common.loading') : (!canSend ? `🔒 ${t('notificationsHub.tipBody').split(' ')[0]}` : <><Send size={18} /> {t('reports.sendSet1')}</>)}
              </button>
          </div>

          <div className="glass-premium" style={{ padding: '24px', border: '1px solid var(--primary)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Send color="var(--primary)" size={24} />
                <h4 style={{ fontWeight: '800', fontSize: '15px' }}>REPORT SET 2</h4>
             </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                {t('reports.set2Desc')}
             </p>
              <button 
                disabled={sending !== null || groupedData.total === 0 || loading || !canSend}
                onClick={() => handleSendReport('2')}
                className="glass-interactive"
                style={{ 
                  width: '100%', padding: '14px', borderRadius: '12px', 
                  background: !canSend ? 'rgba(255,255,255,0.05)' : (sending === '2' ? 'var(--bg-card)' : 'var(--primary)'), 
                  color: !canSend ? 'var(--text-muted)' : 'black', fontWeight: '900', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  opacity: (groupedData.total === 0 || loading) ? 0.5 : 1
                }}
             >
                {sending === '2' ? t('common.loading') : (!canSend ? `🔒 ${t('notificationsHub.tipBody').split(' ')[0]}` : <><ChevronRight size={18} /> {t('reports.sendSet2')}</>)}
              </button>
          </div>

          <div style={{ padding: '16px', background: 'rgba(234, 84, 85, 0.05)', borderRadius: '12px', border: '1px solid rgba(234, 84, 85, 0.1)', display: 'flex', gap: '12px' }}>
             <AlertCircle size={20} color="var(--danger)" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '600' }}>
                {t('reports.cautionNote')}
              </p>
          </div>

          {groupedData.total > 0 && !loading && (
             <div style={{ textAlign: 'center', padding: '10px' }}>
                 <p style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} /> {t('reports.dataReady')}
                 </p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
