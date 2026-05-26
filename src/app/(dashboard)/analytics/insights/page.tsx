'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Brain, Filter, Download, Activity, FileText, Users, Building, AlertTriangle } from 'lucide-react';
import ActivityHeatmap from '@/components/analytics/ActivityHeatmap';

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function InsightsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState('7days');
  const [hospitalId, setHospitalId] = useState('all');
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
      // If we had a specific AI endpoint for generating insight report, we would call it here.
      // For now, we will just simulate a slight delay or call a mock.
      // E.g. fetch('/api/reports/presentation/gemini', { method: 'POST', body: JSON.stringify({ ticketData: data }) })
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setAiReport({
        executiveSummary: "จากการวิเคราะห์ข้อมูลพบว่า มีการแจ้งปัญหาเข้ามาอย่างหนาแน่นในช่วงต้นสัปดาห์ โดยเฉพาะวันจันทร์และอังคาร",
        keyChallenges: [
          { title: "ปัญหาเน็ตเวิร์ก", description: "พบการแจ้งเรื่องสัญญาณหลุดบ่อยครั้งในกลุ่มโรงพยาบาลศูนย์" }
        ],
        actionItems: [
          { action: "ตรวจสอบอุปกรณ์ Router", owner: "ทีม Network", targetDate: "2026-06-01" }
        ]
      });
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-cyan-500 flex flex-col items-center">
          <Activity className="w-8 h-8 animate-spin mb-4" />
          <p>กำลังโหลดข้อมูลเชิงลึก...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto text-white space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
            <Brain className="w-6 h-6 text-cyan-400" />
            AI Support Insights
          </h1>
          <p className="text-white/60 text-sm mt-1">วิเคราะห์พฤติกรรมการแจ้งปัญหาและแนวโน้มการทำงาน</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
            <Filter className="w-4 h-4 text-white/50" />
            <select 
              value={preset} 
              onChange={(e) => setPreset(e.target.value)}
              className="bg-transparent text-sm outline-none text-white/90"
            >
              <option value="7days">7 วันล่าสุด</option>
              <option value="30days">30 วันล่าสุด</option>
              <option value="all">ทั้งหมด (All Time)</option>
            </select>
          </div>
          
          <button 
            onClick={handleGenerateReport}
            disabled={generatingReport || loading}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50"
          >
            {generatingReport ? <Activity className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {generatingReport ? 'กำลังวิเคราะห์...' : 'Generate AI Report'}
          </button>
        </div>
      </div>

      {aiReport && (
        <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 p-6 rounded-xl border border-blue-500/30 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Brain className="w-32 h-32" />
          </div>
          <h2 className="text-xl font-bold text-cyan-300 mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5" /> AI Executive Summary
          </h2>
          <p className="text-white/90 leading-relaxed mb-6">{aiReport.executiveSummary}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/30 p-4 rounded-lg border border-white/5">
              <h3 className="text-orange-400 font-medium mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Key Challenges
              </h3>
              <ul className="space-y-3">
                {aiReport.keyChallenges.map((kc: any, i: number) => (
                  <li key={i} className="text-sm">
                    <strong className="block text-white/90">{kc.title}</strong>
                    <span className="text-white/60">{kc.description}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-black/30 p-4 rounded-lg border border-white/5">
              <h3 className="text-green-400 font-medium mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Action Items
              </h3>
              <ul className="space-y-3">
                {aiReport.actionItems.map((ai: any, i: number) => (
                  <li key={i} className="text-sm border-l-2 border-green-500/50 pl-3">
                    <strong className="block text-white/90">{ai.action}</strong>
                    <span className="text-white/50 text-xs mt-1 block">Owner: {ai.owner} | Due: {ai.targetDate}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Top Row: Hospitals & Issue Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white/90">
            <Building className="w-5 h-5 text-blue-400" />
            Top Hospitals by Volume
          </h2>
          <div className="h-[300px] w-full">
            {data?.topHospitals?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topHospitals} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" stroke="#ffffff40" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={120} stroke="#ffffff40" fontSize={12} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">ไม่มีข้อมูล</div>
            )}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white/90">
            <Activity className="w-5 h-5 text-purple-400" />
            Issue Types Breakdown
          </h2>
          <div className="h-[300px] w-full flex items-center justify-center relative">
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
                      <Cell key={`cell-\${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">ไม่มีข้อมูล</div>
            )}
          </div>
        </div>
      </div>

      {/* Middle Row: New Features (Top Subjects & Top Staff) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white/90">
            <FileText className="w-5 h-5 text-pink-400" />
            เรื่องที่แจ้งมาบ่อยที่สุด (Top Subjects)
          </h2>
          <div className="space-y-3">
            {data?.topSubjects?.length > 0 ? (
              data.topSubjects.map((subject: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/60">
                      {idx + 1}
                    </div>
                    <span className="text-sm text-white/90 truncate max-w-[200px] md:max-w-[250px]">{subject.name}</span>
                  </div>
                  <span className="text-cyan-400 font-semibold">{subject.count} เคส</span>
                </div>
              ))
            ) : (
              <div className="text-center text-white/40 py-8">ไม่มีข้อมูล</div>
            )}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white/90">
            <Users className="w-5 h-5 text-emerald-400" />
            เจ้าหน้าที่โรงพยาบาลที่แจ้งบ่อยที่สุด
          </h2>
          <div className="space-y-3">
            {data?.topStaff?.length > 0 ? (
              data.topStaff.map((staff: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white/90">{staff.name}</span>
                    <span className="text-xs text-white/50">{staff.hospital}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold text-lg">{staff.count}</span>
                    <span className="text-xs text-white/40">ใบงาน</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-white/40 py-8">ไม่มีข้อมูล</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Activity Heatmap */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white/90">
          <Activity className="w-5 h-5 text-cyan-400" />
          ความหนาแน่นของการแจ้งปัญหา (Activity Heatmap)
        </h2>
        {data?.heatmapData && (
          <ActivityHeatmap data={data.heatmapData} />
        )}
      </div>

    </div>
  );
}
