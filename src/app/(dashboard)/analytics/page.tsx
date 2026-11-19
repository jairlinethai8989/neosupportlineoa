'use client';
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
  RefreshCw
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
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DateTime } from 'luxon';
import { supabase } from '@/lib/supabase';
import { exportToExcel, exportToPDF } from '@/lib/utils/exportUtils';
import type { Ticket } from '@/types';

interface ChartType {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  type: string;
}

interface ChartDataPoint {
  name: string;
  value: number;
}

interface ScatterDataPoint {
  x: number;
  y: number;
}

/**
 * 1. Define Chart Types & Mock Logic for 16 variations
 */
const CHART_TYPES: ChartType[] = [
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

interface SortableWidgetProps {
  id: string;
  chart: ChartType;
  data: ChartDataPoint[] | ScatterDataPoint[];
  onRemove: (id: string) => void;
}

/**
 * 2. Sortable Widget Component
 */
const SortableWidget = ({ id, chart, data, onRemove }: SortableWidgetProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    if (data.length > 0 && selectedItems.length === 0) {
      setTimeout(() => {
        setSelectedItems(data.map((d) => (d as ChartDataPoint).name));
      }, 0);
    }
  }, [data]);

  const filteredData = useMemo(() => {
    return (data as ChartDataPoint[]).filter((d) => selectedItems.includes(d.name));
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
    const common = { width: '100%' as const, height: 240 };
    switch (chart.type) {
      case 'bar':
        return (
          <ResponsiveContainer {...common}>
            <BarChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
              <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer {...common}>
            <PieChart>
              <Pie data={filteredData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {filteredData.map((entry, index) => (
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} />
              <Tooltip cursor={{ stroke: 'var(--primary)', strokeWidth: 2 }} />
              <Area type="monotone" dataKey="value" stroke="var(--primary)" fillOpacity={1} fill={`url(#colorValue-${id})`} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'radar':
        return (
          <ResponsiveContainer {...common}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={filteredData}>
              <PolarGrid stroke="rgba(128,128,128,0.2)" />
              <PolarAngleAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
              <Radar name="Performance" dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.5} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        );
      case 'scatter':
        return (
          <ResponsiveContainer {...common}>
            <ScatterChart>
              <CartesianGrid stroke="rgba(128,128,128,0.2)" />
              <XAxis type="number" dataKey="x" name="time" stroke="var(--text-muted)" fontSize={10} />
              <YAxis type="number" dataKey="y" name="value" stroke="var(--text-muted)" fontSize={10} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Points" data={data as ScatterDataPoint[]} fill="var(--primary)" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      default:
        return <div className="flex-center" style={{ height: '240px', color: 'var(--text-muted)' }}>Chart Type: {chart.type}</div>;
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="glass">
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <chart.icon size={16} color="var(--primary)" />
          <h3 style={{ fontSize: '13px', fontWeight: '800' }}>{chart.name}</h3>
        </div>
        <button onClick={() => onRemove(id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '11px', fontWeight: '800' }}>ลบออก</button>
      </div>
      <div style={{ padding: '20px' }}>
        {renderChart()}
        
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
           {data.map((d) => (
             <label key={(d as ChartDataPoint).name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', opacity: selectedItems.includes((d as ChartDataPoint).name) ? 1 : 0.4 }}>
                <input 
                  type="checkbox" 
                  checked={selectedItems.includes((d as ChartDataPoint).name)} 
                  onChange={() => toggleItem((d as ChartDataPoint).name)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                {(d as ChartDataPoint).name}
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
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);
    setTickets((data || []) as Ticket[]);
    setLoading(false);
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
    
    const statusCounts = tickets.reduce<Record<string, number>>((acc, t) => { 
      acc[t.status] = (acc[t.status] || 0) + 1; 
      return acc; 
    }, {});
    const priorityCounts = tickets.reduce<Record<string, number>>((acc, t) => { 
      acc[t.priority] = (acc[t.priority] || 0) + 1; 
      return acc; 
    }, {});
    
    return {
      'bar-status': Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
      'pie-priority': Object.entries(priorityCounts).map(([name, value]) => ({ name, value })),
      'line-trend': tickets.slice(0, 7).map((t, i) => ({ name: `Day ${i+1}`, value: (i * 5 + 10) % 25 })),
      'area-volume': tickets.slice(0, 10).map((t, i) => ({ name: `T-${i}`, value: (i * 8 + 15) % 45 })),
      'radar-agent': [
        { name: 'Speed', value: 80 }, { name: 'CSAT', value: 95 }, { name: 'Volume', value: 70 }, 
        { name: 'FCR', value: 60 }, { name: 'Tech', value: 85 }
      ],
      'scatter-response': Array.from({ length: 20 }, (_, i) => ({ x: i, y: (i * 13 + 20) % 100 })),
    };
  }, [tickets]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setActiveWidgets((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    const dataToExport = tickets.map(t => ({
      'ID': t.ticket_no,
      'Subject': t.subject,
      'Status': t.status,
      'Priority': t.priority,
      'Created At': DateTime.fromISO(t.created_at).toFormat('dd/MM/yyyy HH:mm:ss')
    }));

    if (format === 'excel') {
      exportToExcel(dataToExport, 'Analytics_Report');
    } else {
      exportToPDF(dataToExport, 'Analytics_Report', 'Executive Intelligence Report');
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px', marginBottom: '32px' }}>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>ศูนย์บริหารสถิติอัจฉริยะ</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>EXECUTIVE INTELLIGENCE CENTER (EIC) • Drag & Drop Workspace</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
           <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-card)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border)', alignItems: 'center' }}>
              <Calendar size={14} color="var(--primary)" />
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={e => setDateRange({...dateRange, start: e.target.value})}
                style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '12px', outline: 'none', width: '110px' }} 
              />
              <span style={{ color: 'var(--text-muted)' }}>-</span>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={e => setDateRange({...dateRange, end: e.target.value})}
                style={{ background: 'none', border: 'none', color: 'white', fontSize: '12px', outline: 'none', width: '110px' }} 
              />
           </div>

           <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleExport('excel')} className="glass-interactive flex-center" style={{ height: '42px', padding: '0 16px', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--success)', gap: '8px', fontWeight: 'bold', fontSize: '13px' }}>
                 <FileSpreadsheet size={18} /> EXCEL
              </button>
              <button onClick={() => handleExport('pdf')} className="glass-interactive flex-center" style={{ height: '42px', padding: '0 16px', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--danger)', gap: '8px', fontWeight: 'bold', fontSize: '13px' }}>
                 <Download size={18} /> PDF
              </button>
           </div>
        </div>
      </div>

      {/* Widget Selector Wrapped */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '20px', marginBottom: '32px' }}>
         <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>เพิ่มวิดเจ็ตสถิติ (Add Statistics Widget)</p>
         <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {CHART_TYPES.map(ct => (
              <button 
                key={ct.id}
                onClick={() => !activeWidgets.includes(ct.id) && setActiveWidgets([...activeWidgets, ct.id])}
                disabled={activeWidgets.includes(ct.id)}
                className="glass-interactive"
                style={{ 
                  padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border)', 
                  fontSize: '12px', fontWeight: '700',
                  opacity: activeWidgets.includes(ct.id) ? 0.3 : 1,
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: activeWidgets.includes(ct.id) ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                  cursor: activeWidgets.includes(ct.id) ? 'default' : 'pointer'
                }}>
                <ct.icon size={14} color={activeWidgets.includes(ct.id) ? 'var(--text-muted)' : 'var(--primary)'} /> 
                {ct.name}
              </button>
            ))}
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
