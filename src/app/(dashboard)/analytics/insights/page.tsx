'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Brain, Filter, Activity, FileText, Users, Building, AlertTriangle } from 'lucide-react';
import ActivityHeatmap from '@/components/analytics/ActivityHeatmap';

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function InsightsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState('all'); // Change default to 'all' so data shows up
  const [hospitalId, setHospitalId] = useState('all');
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [preset, hospitalId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/insights?preset=${preset}&hospitalId=${hospitalId}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json);
      if (json.hospitals) {
        setHospitals(json.hospitals);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setAiReport(null);
    try {
      const res = await fetch(`/api/analytics/insights?preset=${preset}&hospitalId=${hospitalId}&ai=true`);
      if (!res.ok) throw new Error('Failed to generate AI report');
      const json = await res.json();
      if (json.aiReport) {
        setAiReport(json.aiReport);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Activity size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <p>กำลังโหลดข้อมูลเชิงลึก...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-in" style={{ padding: '0', maxWidth: '100%', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="glass" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
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

      {/* Top Row: Hospitals & Issue Types */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        <div className="glass" style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <Building size={20} color="var(--primary)" />
            Top Hospitals by Volume
          </h2>
          <div style={{ height: '300px', width: '100%' }}>
            {data?.topHospitals?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topHospitals} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" width={120} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: 'var(--bg-card)'}}
                    contentStyle={{ backgroundColor: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)' }}
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>ไม่มีข้อมูล</div>
            )}
          </div>
        </div>

        <div className="glass" style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <Activity size={20} color="#a855f7" />
            Issue Types Breakdown
          </h2>
          <div style={{ height: '300px', width: '100%' }}>
            {data?.issueTypes?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.issueTypes}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {data.issueTypes.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>ไม่มีข้อมูล</div>
            )}
          </div>
        </div>
      </div>

      {/* Middle Row: New Features (Top Subjects & Top Staff) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        <div className="glass" style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <FileText size={20} color="#ec4899" />
            เรื่องที่แจ้งมาบ่อยที่สุด (Top Subjects)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data?.topSubjects?.length > 0 ? (
              data.topSubjects.map((subject: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {idx + 1}
                    </div>
                    <span style={{ fontSize: '14px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{subject.name}</span>
                  </div>
                  <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{subject.count} เคส</span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px 0' }}>ไม่มีข้อมูล</div>
            )}
          </div>
        </div>

        <div className="glass" style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <Users size={20} color="var(--success)" />
            เจ้าหน้าที่โรงพยาบาลที่แจ้งบ่อยที่สุด
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data?.topStaff?.length > 0 ? (
              data.topStaff.map((staff: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{staff.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{staff.hospital}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--success)', fontWeight: '700', fontSize: '18px' }}>{staff.count}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>ใบงาน</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px 0' }}>ไม่มีข้อมูล</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Activity Heatmap */}
      <div className="glass" style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
          <Activity size={20} color="var(--primary)" />
          ความหนาแน่นของการแจ้งปัญหา (Activity Heatmap)
        </h2>
        {data?.heatmapData && data.heatmapData.length > 0 ? (
          <ActivityHeatmap data={data.heatmapData} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px 0' }}>ไม่มีข้อมูล</div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
