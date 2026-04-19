'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart as BarChartIcon, 
  PieChart as PieChartIcon, 
  LineChart as LineChartIcon,
  Filter,
  Calendar,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  Settings,
  LayoutGrid,
  FileText as FileIcon,
  RefreshCw,
  CheckCircle,
  Zap
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, Bar, 
  LineChart, Line, 
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area,
  ComposedChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter,
  Treemap
} from 'recharts';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DateTime } from 'luxon';
import { supabase } from '@/lib/supabase';
import { exportToExcel, exportToPDF, exportDashboardAsPDF } from '@/lib/utils/exportUtils';
import Skeleton from '@/components/ui/Skeleton';
import html2canvas from 'html2canvas';

/**
 * 1. Define Chart Types & Mock Logic for 16 variations
 */
const CHART_TYPES = [
  { id: 'bar-status', name: 'งานแยกตามสถานะ (Status Bar)', icon: BarChartIcon, type: 'bar' },
  { id: 'pie-priority', name: 'สัดส่วนความสำคัญ (Priority Pie)', icon: PieChartIcon, type: 'pie' },
  { id: 'line-trend', name: 'แนวโน้มใบงาน (Ticket Trend)', icon: LineChartIcon, type: 'line' },
  { id: 'area-volume', name: 'ปริมาณภาระงาน (Volume Area)', icon: LineChartIcon, type: 'area' },
  { id: 'radar-agent', name: 'สมรรถนะแอดมิน (Agent Radar)', icon: Settings, type: 'radar' },
  { id: 'scatter-response', name: 'เวลาตอบกลับ (Response Scatter)', icon: LayoutGrid, type: 'scatter' },
  { id: 'bar-category', name: 'หมวดหมู่ปัญหา (Category Bar)', icon: BarChartIcon, type: 'bar' },
  { id: 'pie-sla', name: 'สถานะ SLA (SLA Compliance)', icon: PieChartIcon, type: 'pie' },
  { id: 'composed-mix', name: 'ภาพรวมผสม (Mixed Overview)', icon: LayoutGrid, type: 'composed' },
  { id: 'tree-tags', name: 'แท็กยอดนิยม (Tag Treemap)', icon: FileIcon, type: 'treemap' },
  { id: 'line-csat', name: 'ความพึงพอใจ (CSAT Trend)', icon: LineChartIcon, type: 'line' },
  { id: 'bar-resolution', name: 'เวลาปิดงาน (Resolution Bar)', icon: BarChartIcon, type: 'bar' },
  { id: 'pie-channel', name: 'ช่องทางแจ้งเรื่อง (Channel Pie)', icon: PieChartIcon, type: 'pie' },
  { id: 'area-peak', name: 'ช่วงเวลาที่งานเยอะ (Peak Hours)', icon: LineChartIcon, type: 'area' },
  { id: 'radar-skill', name: 'ทักษะทีมงาน (Team Skills)', icon: Settings, type: 'radar' },
  { id: 'scatter-load', name: 'ภาระงานรายวัน (Daily Load)', icon: LayoutGrid, type: 'scatter' }
];

const COLORS = ['#00f2fe', '#4facfe', '#7367f0', '#28c76f', '#ff9f43', '#ea5455', '#9f44d3', '#f1f5f9'];

/**
 * 2. Sortable Widget Component
 */
const SortableWidget = ({ id, chart, data, onRemove }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    if (data.length > 0 && selectedItems.length === 0) {
      setTimeout(() => {
        setSelectedItems(data.map((d: any) => d.name));
      }, 0);
    }
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((d: any) => selectedItems.includes(d.name));
  }, [data, selectedItems]);

  const toggleItem = (name: string) => {
    setSelectedItems(prev => 
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
  };
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const renderChart = () => {
    const common = { width: "100%", height: 240 } as any;
    switch (chart.type) {
      case 'bar':
        return (
          <ResponsiveContainer {...common}>
            <BarChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={12} tick={{ fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-dim)" fontSize={12} tick={{ fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                itemStyle={{ color: 'var(--text-main)', fontSize: '12px', fontWeight: '700' }}
              />
              <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer {...common}>
            <PieChart>
              <Pie data={filteredData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {filteredData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer {...common}>
            <LineChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={12} tick={{ fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-dim)" fontSize={12} tick={{ fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }} />
              <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--bg-card)' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer {...common}>
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id={`colorValue-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={12} tick={{ fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-dim)" fontSize={12} tick={{ fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }} />
              <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill={`url(#colorValue-${id})`} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'radar':
        return (
          <ResponsiveContainer {...common}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={filteredData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="name" stroke="var(--text-dim)" fontSize={11} tick={{ fill: 'var(--text-dim)', fontWeight: '700' }} />
              <Radar name="Performance" dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.4} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        );
      case 'scatter':
        return (
          <ResponsiveContainer {...common}>
            <ScatterChart>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" dataKey="x" name="time" stroke="var(--text-dim)" fontSize={12} tick={{ fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
              <YAxis type="number" dataKey="y" name="value" stroke="var(--text-dim)" fontSize={12} tick={{ fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }} />
              <Scatter name="Points" data={filteredData} fill="var(--primary)" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      default:
        return <div className="flex-center" style={{ height: '240px', color: 'var(--text-muted)' }}>Chart Type: {chart.type}</div>;
    }
  };

  return (
    <div id={`widget-${id}`} ref={setNodeRef} style={style} className="glass">
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(0,242,254,0.1), rgba(0,98,255,0.1))', padding: '8px', borderRadius: '10px', color: 'var(--primary)', border: '1px solid var(--border-active)' }}>
             <chart.icon size={16} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.3px' }}>{chart.name}</h3>
          {(['radar-agent', 'radar-skill', 'scatter-response', 'scatter-load', 'composed-mix', 'tree-tags'].includes(id)) && (
             <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(255, 171, 0, 0.1)', color: 'var(--warning)', borderRadius: '4px', fontWeight: '800' }}>MOCK DATA</span>
          )}
        </div>
        <button onClick={() => onRemove(id)} style={{ background: 'rgba(234, 84, 85, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '4px 10px', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: '800' }}>ลบออก</button>
      </div>
      <div style={{ padding: '20px' }}>
        {renderChart()}
        
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
           {data.map((d: any) => (
             <label key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', opacity: selectedItems.includes(d.name) ? 1 : 0.7 }}>
                <input 
                  type="checkbox" 
                  checked={selectedItems.includes(d.name)} 
                  onChange={() => toggleItem(d.name)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span style={{ color: selectedItems.includes(d.name) ? 'var(--text-main)' : 'var(--text-dim)' }}>{d.name}</span>
             </label>
           ))}
        </div>
      </div>
    </div>
  );
};

/**
 * 3. Main Analytics Page
 */
export default function AdvancedAnalyticsPage() {
  const [activeWidgets, setActiveWidgets] = useState<string[]>(CHART_TYPES.slice(0, 6).map(c => c.id));
  const [dateRange, setDateRange] = useState({
    start: DateTime.now().minus({ months: 1 }).toISODate(),
    end: DateTime.now().toISODate()
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, csatRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('*, department_data:departments!current_department_id(name)')
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end),
        supabase
          .from('csat_surveys')
          .select('*')
          .not('rating', 'is', null)
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end)
      ]);

      setTickets(ticketsRes.data || []);
      // Pre-calculate CSAT to state or helper
      (window as any)._csat_data = csatRes.data || [];
    } catch (err) {
      console.error('Fetch analytics failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setTimeout(() => {
      if (isMounted) fetchData();
    }, 0);
    return () => { isMounted = false; };
  }, [dateRange]);

  const chartDataMap = useMemo(() => {
    if (!tickets.length) return {};
    
    // 1. Status & Priority
    const statusCounts = tickets.reduce((acc: any, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
    const priorityCounts = tickets.reduce((acc: any, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {});
    const categoryCounts = tickets.reduce((acc: any, t) => { 
      const cat = (t as any).department_data?.name || 'Unassigned';
      acc[cat] = (acc[cat] || 0) + 1; 
      return acc; 
    }, {});

    // 2. Trend (Date Grouping)
    const dailyCounts = tickets.reduce((acc: any, t) => {
      const date = DateTime.fromISO(t.created_at).toFormat('dd MMM');
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
    const trendData = Object.entries(dailyCounts).map(([name, value]) => ({ name, value })).sort((a,b) => a.name.localeCompare(b.name));

    // 3. Peak Hours
    const hourlyCounts = tickets.reduce((acc: any, t) => {
      const hour = DateTime.fromISO(t.created_at).hour;
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});
    const peakData = Array.from({ length: 24 }, (_, i) => ({ name: `${i}:00`, value: hourlyCounts[i] || 0 }));

    // 4. Resolution Time (Hours)
    const resolutionData = tickets
      .filter(t => t.resolved_at)
      .map(t => {
        const diff = DateTime.fromISO(t.resolved_at).diff(DateTime.fromISO(t.created_at), 'hours').hours;
        return { name: t.ticket_no, value: parseFloat(diff.toFixed(1)) };
      }).slice(0, 10);

    // 5. CSAT
    const csatRaw = (window as any)._csat_data || [];
    const csatData = csatRaw.reduce((acc: any, c: any) => {
      const score = c.rating || 0;
      acc[score] = (acc[score] || 0) + 1;
      return acc;
    }, {});

    return {
      'bar-status': Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
      'pie-priority': Object.entries(priorityCounts).map(([name, value]) => ({ name, value })),
      'line-trend': trendData,
      'area-volume': trendData, // Reuse trend for volume
      'bar-category': Object.entries(categoryCounts).map(([name, value]) => ({ name, value })),
      'area-peak': peakData,
      'bar-resolution': resolutionData,
      'line-csat': Object.entries(csatData).map(([name, value]) => ({ name: `Score ${name}`, value })),
      'pie-sla': [
        { name: 'Compliant', value: tickets.filter(t => !t.resolved_at || DateTime.fromISO(t.resolved_at).diff(DateTime.fromISO(t.created_at), 'hours').hours < 24).length },
        { name: 'Breached', value: tickets.filter(t => t.resolved_at && DateTime.fromISO(t.resolved_at).diff(DateTime.fromISO(t.created_at), 'hours').hours >= 24).length },
      ],
      'pie-channel': [
        { name: 'LINE OA', value: tickets.length },
        { name: 'Web Portal', value: 0 },
        { name: 'API', value: 0 }
      ],
      // Remaining are Mock
      'radar-agent': [
        { name: 'Speed', value: 80 }, { name: 'CSAT', value: 95 }, { name: 'Volume', value: 70 }, 
        { name: 'FCR', value: 60 }, { name: 'Tech', value: 85 }
      ],
      'scatter-response': Array.from({ length: 20 }, (_, i) => ({ x: i, y: (i * 13 + 20) % 100 })),
    };
  }, [tickets]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setActiveWidgets((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    const dataToExport = tickets.map(t => ({
      'No.': t.ticket_no,
      'Subject': t.subject,
      'Status': t.status,
      'Priority': t.priority,
      'Created': DateTime.fromISO(t.created_at).toFormat('dd/MM/yyyy')
    }));

    if (format === 'excel') {
      exportToExcel(dataToExport, 'Analytics_Report');
      return;
    }

    // Professional PDF Export with Charts
    setExporting(true);
    try {
      const pages: string[] = [];
      const reportElement = document.getElementById('report-portal');
      
      if (reportElement) {
        reportElement.style.display = 'block';
        
        // Use html2canvas to capture the nicely formatted report
        const canvas = await html2canvas(reportElement, {
          backgroundColor: '#ffffff', // White background for print
          scale: 2,
          useCORS: true,
          windowWidth: 1200
        });
        
        pages.push(canvas.toDataURL('image/png'));
        reportElement.style.display = 'none';
      }

      await exportDashboardAsPDF(
        'Executive Intelligence Report',
        pages,
        'NeoSupport_Report'
      );
    } catch (err) {
      console.error('Export error:', err);
      alert('การส่งออกผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !tickets.length) {
    return (
      <div className="animate-page-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px', marginBottom: '32px' }}>
          <div style={{ flex: '1', minWidth: '300px' }}>
            <Skeleton width="50%" height={36} marginBottom={8} />
            <Skeleton width="40%" height={16} />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
             <Skeleton width={260} height={42} borderRadius={12} />
             <div style={{ display: 'flex', gap: '8px' }}>
                <Skeleton width={100} height={42} borderRadius={12} />
                <Skeleton width={100} height={42} borderRadius={12} />
             </div>
          </div>
        </div>

        <Skeleton width={200} height={36} borderRadius={20} marginBottom={32} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
             <div key={i} className="glass" style={{ height: '340px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Skeleton width={32} height={32} borderRadius={8} />
                      <Skeleton width={150} height={20} />
                   </div>
                   <Skeleton width={60} height={26} borderRadius={8} />
                </div>
                <div style={{ flex: 1, padding: '20px' }}>
                   <Skeleton width="100%" height="80%" marginBottom={16} />
                   <div style={{ display: 'flex', gap: '8px' }}>
                      <Skeleton width={80} height={20} />
                      <Skeleton width={80} height={20} />
                   </div>
                </div>
             </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-in">
      {/* Hidden Report Template for PDF Capture */}
      <div id="report-portal" style={{ 
        display: 'none', 
        width: '1000px', 
        background: '#ffffff', 
        padding: '60px', 
        color: '#000000',
        position: 'absolute',
        left: '-9999px'
      }}>
        <div style={{ borderBottom: '4px solid #7367f0', paddingBottom: '20px', marginBottom: '40px' }}>
           <h1 style={{ fontSize: '32px', color: '#000000', marginBottom: '8px' }}>Executive Intelligence Report</h1>
           <p style={{ color: '#666666' }}>สรุปสถิติการดำเนินงาน • NEO SUPPORT DASHBOARD</p>
        </div>

        <div style={{ marginTop: '40px' }}>
           <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px', color: '#7367f0' }}>ตารางสรุปข้อมูลใบงาน (Ticket Summary)</h3>
           <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                 <tr style={{ background: '#7367f0', color: '#ffffff' }}>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #7367f0' }}>No.</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #7367f0' }}>Subject</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #7367f0' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #7367f0' }}>Priority</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #7367f0' }}>Created</th>
                 </tr>
              </thead>
              <tbody>
                 {tickets.slice(0, 50).map((t, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#fafafa' : '#ffffff' }}>
                       <td style={{ padding: '10px', border: '1px solid #eeeeee' }}>{t.ticket_no}</td>
                       <td style={{ padding: '10px', border: '1px solid #eeeeee' }}>{t.subject}</td>
                       <td style={{ padding: '10px', border: '1px solid #eeeeee' }}>{t.status}</td>
                       <td style={{ padding: '10px', border: '1px solid #eeeeee' }}>{t.priority}</td>
                       <td style={{ padding: '10px', border: '1px solid #eeeeee' }}>{DateTime.fromISO(t.created_at).toFormat('dd/MM/yyyy')}</td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px', marginBottom: '32px' }}>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '4px' }}>ศูนย์บริหารสถิติอัจฉริยะ</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>EXECUTIVE INTELLIGENCE CENTER (EIC) • Drag & Drop Workspace</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
           <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-card)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border)', alignItems: 'center' }}>
              <Calendar size={14} color="var(--primary)" />
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={e => setDateRange({...dateRange, start: e.target.value})}
                style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '14px', fontWeight: '600', outline: 'none', width: '130px' }} 
              />
              <span style={{ color: 'var(--text-muted)' }}>-</span>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={e => setDateRange({...dateRange, end: e.target.value})}
                style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '14px', fontWeight: '600', outline: 'none', width: '130px' }} 
              />
           </div>

           <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => handleExport('excel')} 
                disabled={exporting}
                className="glass-interactive flex-center" 
                style={{ height: '42px', padding: '0 16px', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--success)', gap: '8px', fontWeight: 'bold', fontSize: '13px', opacity: exporting ? 0.5 : 1 }}
              >
                 <FileSpreadsheet size={18} /> EXCEL
              </button>
              <button 
                onClick={() => handleExport('pdf')} 
                disabled={exporting}
                className="glass-interactive flex-center" 
                style={{ height: '42px', padding: '0 16px', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--danger)', gap: '8px', fontWeight: 'bold', fontSize: '13px', opacity: exporting ? 0.5 : 1 }}
              >
                 {exporting ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
                 {exporting ? 'EXPORTING...' : 'PDF REPORT'}
              </button>
           </div>
        </div>
      </div>

      {/* Widget Selector Drawer */}
      <div style={{ marginBottom: '32px' }}>
         <button 
           onClick={() => setShowWidgetSelector(!showWidgetSelector)}
           className="glass-interactive"
           style={{ 
             padding: '8px 20px', 
             borderRadius: '20px', 
             border: '1px solid var(--primary)', 
             background: 'rgba(54, 153, 255, 0.1)',
             color: 'var(--primary)',
             fontSize: '13px', 
             fontWeight: '800', 
             display: 'flex', 
             alignItems: 'center', 
             gap: '10px',
             cursor: 'pointer',
             marginBottom: showWidgetSelector ? '20px' : '0'
           }}>
           <LayoutGrid size={16} /> 
           {showWidgetSelector ? 'ซ่อนเมนูเลือกวิดเจ็ต (Hide Drawer)' : 'เพิ่มวิดเจ็ต (Add Widgets)'}
         </button>

         <div style={{ 
            maxHeight: showWidgetSelector ? '1000px' : '0',
            overflow: 'hidden',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: showWidgetSelector ? 1 : 0,
            borderBottom: showWidgetSelector ? '1px solid var(--border)' : 'none',
            paddingBottom: showWidgetSelector ? '24px' : '0'
         }}>
            <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Available Statistics Widgets</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
               {CHART_TYPES.map(ct => {
                 const isAdded = activeWidgets.includes(ct.id);
                 return (
                   <button 
                     key={ct.id}
                     onClick={() => !isAdded && setActiveWidgets([...activeWidgets, ct.id])}
                     disabled={isAdded}
                     className="glass-interactive"
                     style={{ 
                       padding: '8px 14px', 
                       borderRadius: '10px', 
                       border: '1px solid ' + (isAdded ? 'var(--success)' : 'var(--border)'), 
                       fontSize: '12.5px', 
                       fontWeight: '700',
                       display: 'flex', 
                       alignItems: 'center', 
                       gap: '8px',
                       background: isAdded ? 'rgba(40, 199, 111, 0.05)' : 'rgba(255,255,255,0.03)',
                       cursor: isAdded ? 'default' : 'pointer',
                       color: isAdded ? 'var(--success)' : 'var(--text-muted)',
                       transition: 'all 0.2s ease',
                       minWidth: '180px',
                       justifyContent: 'flex-start'
                     }}>
                     <ct.icon size={14} color={isAdded ? 'var(--success)' : 'var(--primary)'} /> 
                     <span style={{ color: isAdded ? 'var(--success)' : 'inherit' }}>{ct.name}</span>
                   </button>
                 );
               })}
            </div>
         </div>
      </div>

      {/* Dashboard Grid with DND */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeWidgets} strategy={rectSortingStrategy}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
            {activeWidgets.map(id => {
              const chart = CHART_TYPES.find(c => c.id === id);
              if (!chart) return null;
              return (
                <SortableWidget 
                  key={id} 
                  id={id} 
                  chart={chart} 
                  data={chartDataMap[id as keyof typeof chartDataMap] || []}
                  onRemove={(rid: string) => setActiveWidgets(prev => prev.filter(w => w !== rid))}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {loading && (
        <div style={{ position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: 'black', padding: '12px 24px', borderRadius: '30px', fontWeight: '900', boxShadow: '0 8px 32px rgba(0,242,254,0.4)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <RefreshCw size={20} className="animate-spin" />
          กำลังวิเคราะห์ข้อมูล...
        </div>
      )}
    </div>
  );
}
