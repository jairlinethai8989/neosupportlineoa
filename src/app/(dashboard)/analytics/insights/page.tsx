/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Filter, Activity, AlertTriangle, Building } from 'lucide-react';

export default function InsightsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState('30days'); // Start with 30 days as a reasonable default
  const [hospitalId, setHospitalId] = useState('all');
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);

  // Light fetch for hospitals list only on mount
  useEffect(() => {
    async function fetchHospitals() {
      try {
        const res = await fetch('/api/analytics/insights?hospitalsOnly=true');
        if (res.ok) {
          const json = await res.json();
          if (json.hospitals) {
            setHospitals(json.hospitals);
          }
        }
      } catch (err) {
        console.error('Error fetching hospitals:', err);
      }
    }
    fetchHospitals();
  }, []);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setAiReport(null);
    setData(null);
    try {
      const res = await fetch(`/api/analytics/insights?preset=${preset}&hospitalId=${hospitalId}&ai=true&customPrompt=${encodeURIComponent(customPrompt)}`);
      if (!res.ok) throw new Error('Failed to generate AI report');
      const json = await res.json();
      setData(json);
      if (json.aiReport) {
        setAiReport(json.aiReport);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingReport(false);
    }
  };

  // No initial loading screen


  return (
    <div className="animate-page-in" style={{ padding: '0', maxWidth: '100%', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="glass" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
              <Brain size={28} />
              AI Support Insights
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>วิเคราะห์พฤติกรรมการแจ้งปัญหาและแนวโน้มการทำงานอัจฉริยะ</p>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
            {/* Preset Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <Filter size={16} color="var(--primary)" />
              <select 
                value={preset} 
                onChange={(e) => setPreset(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
              >
                <option value="7days">7 วันล่าสุด</option>
                <option value="30days">30 วันล่าสุด</option>
                <option value="all">ทั้งหมด (All Time)</option>
              </select>
            </div>

            {/* Hospital Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <Building size={16} color="var(--primary)" />
              <select 
                value={hospitalId} 
                onChange={(e) => setHospitalId(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '14px', outline: 'none', maxWidth: '200px' }}
              >
                <option value="all">โรงพยาบาลทั้งหมด</option>
                {hospitals.map((h: any) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Custom Prompt Input Section */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--bg-card)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <Brain size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
          <input 
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="ต้องการให้ AI เน้นวิเคราะห์ด้านใดเพิ่มเติมเป็นพิเศษหรือไม่? (เช่น 'วิเคราะห์หาสาเหตุของปัญหาเรื่องยา', 'แนะนำการคุยกับเจ้าหน้าที่ รพ.เกาะคา')"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '14px', outline: 'none', flex: 1 }}
          />
          <button 
            onClick={handleGenerateReport}
            disabled={generatingReport || loading}
            className="glass-interactive"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--border-active) 100%)', color: 'white', padding: '10px 20px', borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 15px var(--primary-transparent)', cursor: (generatingReport || loading) ? 'not-allowed' : 'pointer', opacity: (generatingReport || loading) ? 0.6 : 1 }}
          >
            {generatingReport ? <Activity size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={18} />}
            {generatingReport ? 'กำลังวิเคราะห์...' : 'Generate AI Report'}
          </button>
        </div>
      </div>

      {aiReport && (
        <div className="glass" style={{ position: 'relative', overflow: 'hidden', padding: '24px', borderRadius: '16px', border: '1px solid var(--primary)', background: 'linear-gradient(to bottom right, rgba(6, 182, 212, 0.1), rgba(59, 130, 246, 0.1))' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, padding: '20px', opacity: 0.05, pointerEvents: 'none' }}>
            <Brain size={150} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Brain size={24} /> AI Executive Summary
          </h2>
          <p style={{ color: 'var(--text-main)', lineHeight: '1.6', marginBottom: '24px' }}>{aiReport.executiveSummary}</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-sidebar)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ color: '#f59e0b', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} /> Key Challenges
              </h3>
              <ul style={{ paddingLeft: '0', listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {aiReport.keyChallenges.map((kc: any, i: number) => (
                  <li key={i} style={{ fontSize: '14px' }}>
                    <strong style={{ display: 'block', color: 'var(--text-main)' }}>{kc.title}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>{kc.description}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div style={{ background: 'var(--bg-sidebar)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ color: 'var(--success)', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} /> Action Items
              </h3>
              <ul style={{ paddingLeft: '0', listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {aiReport.actionItems.map((ai: any, i: number) => (
                  <li key={i} style={{ fontSize: '14px', borderLeft: '2px solid var(--success)', paddingLeft: '12px' }}>
                    <strong style={{ display: 'block', color: 'var(--text-main)' }}>{ai.action}</strong>
                    <span style={{ color: 'var(--text-dim)', fontSize: '12px', display: 'block', marginTop: '4px' }}>Owner: {ai.owner} | Due: {ai.targetDate}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
