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
import { GripVertical, X } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import styles from './analytics.module.css';

const COLORS = ['#1D4ED8', '#0D9488', '#0284C7', '#059669', '#D97706', '#DC2626', '#475569', '#2563EB'];

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
    setSelectedItems((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  };

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.55 : 1,
  };

  const tooltipStyle = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
  };

  const renderChart = () => {
    const common = { width: '100%', height: 240 } as any;
    switch (chart.type) {
      case 'bar':
        return (
          <ResponsiveContainer {...common}>
            <BarChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--color-text-subtle)" fontSize={12} tick={{ fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--color-text-subtle)" fontSize={12} tick={{ fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: 'var(--color-text)', fontSize: '12px', fontWeight: '600' }}
              />
              <Bar dataKey="value" fill="#1D4ED8" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer {...common}>
            <PieChart>
              <Pie data={filteredData} innerRadius={56} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
                {filteredData.map((_entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer {...common}>
            <LineChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--color-text-subtle)" fontSize={12} tick={{ fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--color-text-subtle)" fontSize={12} tick={{ fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#1D4ED8"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#1D4ED8', strokeWidth: 2, stroke: 'var(--color-surface)' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer {...common}>
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id={`colorValue-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--color-text-subtle)" fontSize={12} tick={{ fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--color-text-subtle)" fontSize={12} tick={{ fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="value" stroke="#1D4ED8" strokeWidth={2.5} fillOpacity={1} fill={`url(#colorValue-${id})`} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'radar':
        return (
          <ResponsiveContainer {...common}>
            <RadarChart cx="50%" cy="50%" outerRadius="78%" data={filteredData}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tick={{ fill: 'var(--color-text-muted)', fontWeight: '600' }} />
              <Radar name="Performance" dataKey="value" stroke="#1D4ED8" fill="#1D4ED8" fillOpacity={0.28} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        );
      case 'scatter':
        return (
          <ResponsiveContainer {...common}>
            <ScatterChart>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" dataKey="x" name="time" stroke="var(--color-text-subtle)" fontSize={12} tick={{ fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis type="number" dataKey="y" name="value" stroke="var(--color-text-subtle)" fontSize={12} tick={{ fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
              <Scatter name="Points" data={filteredData} fill="#0D9488" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <div className="flex-center" style={{ height: 240, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Chart Type: {chart.type}
          </div>
        );
    }
  };

  return (
    <div id={`widget-${id}`} ref={setNodeRef} style={style}>
      <Card>
        <CardHeader
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(id)}
              aria-label={`ลบวิดเจ็ต ${chart.name}`}
              leftIcon={<X size={14} aria-hidden="true" />}
            >
              ลบออก
            </Button>
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              {...attributes}
              {...listeners}
              className={styles.dragHandleBtn}
              aria-label={`ลากเพื่อจัดเรียง ${chart.name}`}
            >
              <GripVertical size={14} color="var(--color-text-subtle)" aria-hidden="true" />
              <span className={styles.dragIconBox} aria-hidden="true">
                <chart.icon size={15} />
              </span>
              <span className={styles.widgetTitle}>{chart.name}</span>
            </button>
            {['radar-skill', 'composed-mix', 'tree-tags'].includes(id) ? (
              <Badge variant="warning" size="sm">
                ตัวอย่างข้อมูล
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardBody>
          {renderChart()}
          {data.length > 0 ? (
            <div className={styles.widgetSeriesFilter}>
              {data.map((d: any, idx: number) => {
                const checkId = `widget-series-${id}-${idx}`;
                return (
                  <label key={d.name} htmlFor={checkId} className={styles.seriesCheckLabel}>
                    <input
                      id={checkId}
                      type="checkbox"
                      checked={selectedItems.includes(d.name)}
                      onChange={() => toggleItem(d.name)}
                      aria-label={`แสดงข้อมูล ${d.name}`}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span>{d.name}</span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
};
