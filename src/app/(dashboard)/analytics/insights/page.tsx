/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Activity, AlertTriangle } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Input, PageHeader, Select } from '@/components/ui';
import styles from '@/components/analytics/analytics.module.css';

export default function InsightsPage() {
  const [data, setData] = useState<any>(null);
  const [loading] = useState(false);
  const [preset, setPreset] = useState('30days');
  const [organizationId, setHospitalId] = useState('all');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const res = await fetch('/api/analytics/insights?organizationsOnly=true');
        if (res.ok) {
          const json = await res.json();
          if (json.organizations) {
            setOrganizations(json.organizations);
          }
        }
      } catch (err) {
        console.error('Error fetching organizations:', err);
      }
    }
    void fetchOrganizations();
  }, []);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setAiReport(null);
    setData(null);
    try {
      const res = await fetch(
        `/api/analytics/insights?preset=${preset}&organizationId=${organizationId}&ai=true&customPrompt=${encodeURIComponent(customPrompt)}`
      );
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

  void data;

  return (
    <div className={`animate-page-in ${styles.pageStack}`}>
      <PageHeader
        title="AI Support Insights"
        subtitle="วิเคราะห์พฤติกรรมการแจ้งปัญหาและแนวโน้มการทำงานอัจฉริยะ"
      />

      <Card>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
              <Select
                id="insights-preset"
                label="ช่วงเวลาย้อนหลัง"
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
              >
                <option value="7days">7 วันล่าสุด</option>
                <option value="30days">30 วันล่าสุด</option>
                <option value="all">ทั้งหมด (All Time)</option>
              </Select>

              <Select
                id="insights-org"
                label="องค์กร / บริษัท"
                value={organizationId}
                onChange={(e) => setHospitalId(e.target.value)}
              >
                <option value="all">องค์กร/บริษัททั้งหมด</option>
                {organizations.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </Select>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <Input
                id="insights-custom-prompt"
                label="คำสั่งวิเคราะห์เพิ่มเติม (ไม่บังคับ)"
                wrapperClassName="flex-1"
                leftIcon={<Brain size={16} aria-hidden="true" />}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="เช่น 'วิเคราะห์หาสาเหตุของปัญหาเรื่องยา', 'แนะนำการคุยกับเจ้าหน้าที่'"
                style={{ minWidth: '260px' }}
              />
              <Button
                variant="primary"
                size="md"
                onClick={handleGenerateReport}
                loading={generatingReport}
                disabled={loading}
                leftIcon={<Brain size={16} aria-hidden="true" />}
              >
                {generatingReport ? 'กำลังวิเคราะห์...' : 'สร้างรายงาน AI'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {aiReport ? (
        <Card style={{ borderColor: 'var(--color-primary)' }}>
          <CardHeader>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Brain size={20} aria-hidden="true" />
              AI Executive Summary
            </h2>
          </CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text)', lineHeight: 1.65, marginBottom: 'var(--space-5)' }}>
              {aiReport.executiveSummary}
            </p>

            <div className={styles.twoColGrid}>
              <div className={styles.metricBox}>
                <h3 style={{ color: 'var(--color-warning-text)', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-md)' }}>
                  <AlertTriangle size={18} aria-hidden="true" />
                  Key Challenges
                </h3>
                <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {aiReport.keyChallenges.map((kc: any, i: number) => (
                    <li key={i} style={{ fontSize: 'var(--text-sm)' }}>
                      <strong style={{ display: 'block', color: 'var(--color-text)' }}>{kc.title}</strong>
                      <span style={{ color: 'var(--color-text-muted)' }}>{kc.description}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.metricBox}>
                <h3 style={{ color: 'var(--color-success-text)', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-md)' }}>
                  <Activity size={18} aria-hidden="true" />
                  Action Items
                </h3>
                <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {aiReport.actionItems.map((ai: any, i: number) => (
                    <li key={i} style={{ fontSize: 'var(--text-sm)', borderLeft: '3px solid var(--color-success)', paddingLeft: 12 }}>
                      <strong style={{ display: 'block', color: 'var(--color-text)' }}>{ai.action}</strong>
                      <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)', display: 'block', marginTop: 4 }}>
                        Owner: {ai.owner} | Due: {ai.targetDate}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
