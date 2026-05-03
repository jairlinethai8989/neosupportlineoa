'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ScatterChart, Scatter,
} from 'recharts';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COLORS = ['#00f2fe', '#4facfe', '#7367f0', '#28c76f', '#ff9f43', '#ea5455', '#9f44d3', '#f1f5f9'];

export const SortableWidget = ({ id, chart, data, onRemove }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    if (data.length > 0 && selectedItems.length === 0) {
      setTimeout(() => {
        setSelectedItems(data.map((d: any) => d.name));
      }, 0);
    }
  }, [data, selectedItems.length]);

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
    const common = { width: '100%', height: 240 } as any;
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
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
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
