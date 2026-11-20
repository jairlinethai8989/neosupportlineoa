'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Bot,
  Sparkles,
  Save,
  Star,
  AlertCircle,
  TrendingUp,
  Activity,
  MessageSquare,
  ClipboardList,
} from 'lucide-react';
import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import styles from '@/components/analytics/analytics.module.css';

interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
  status: string;
}

interface EvaluationScores {
  system_data_expertise: number;
  troubleshooting_sla: number;
  shift_availability: number;
  handover_quality: number;
  knowledge_sharing: number;
  crisis_communication: number;
  emotional_regulation: number;
  learning_agility: number;
}

const DEFAULT_SCORES: EvaluationScores = {
  system_data_expertise: 3,
  troubleshooting_sla: 3,
  shift_availability: 3,
  handover_quality: 3,
  knowledge_sharing: 3,
  crisis_communication: 3,
  emotional_regulation: 3,
  learning_agility: 3,
};

export default function Evaluation360Page() {
  const { userProfile } = useAppContext();
  const { addToast } = useNotificationContext();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [saving, setSaving] = useState(false);

  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [evaluatorRole, setEvaluatorRole] = useState<'lead' | 'peer' | 'user' | 'self'>('lead');
  const [period, setPeriod] = useState<string>('');

  const [scores, setScores] = useState<EvaluationScores>({ ...DEFAULT_SCORES });
  const [comments, setComments] = useState<string>('');
  const [isAiGenerated, setIsAiGenerated] = useState<boolean>(false);

  const [kpiStats, setKpiStats] = useState({
    totalClaimed: 0,
    resolvedCount: 0,
    avgResolutionTime: 0,
    slaComplianceRate: 0,
    reworkRate: 0,
    avgCsat: 0,
  });

  const [dateRange] = useState({
    start: DateTime.now().minus({ days: 30 }).toISODate()!,
    end: DateTime.now().toISODate()!,
  });

  useEffect(() => {
    const startDT = DateTime.fromISO(dateRange.start);
    setPeriod(`${startDT.toFormat('yyyy-MM')}`);
  }, [dateRange]);

  const hasAccess = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'Administrator') return true;
    return userProfile.permissions?.analytics_staff === 'view' || userProfile.permissions?.analytics_staff === 'edit';
  }, [userProfile]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchStaffList = useCallback(async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, status')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setStaffList(profiles || []);

      if (profiles && profiles.length > 0) {
        setSelectedAgentId(profiles[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch staff list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess && mounted) {
      void fetchStaffList();
    } else if (mounted) {
      setLoading(false);
    }
  }, [fetchStaffList, hasAccess, mounted]);

  const fetchAgentRealStats = useCallback(
    async (agentId: string) => {
      if (!agentId) return;
      setLoadingStats(true);
      try {
        const { data: tickets, error } = await supabase
          .from('tickets')
          .select('id, status, created_at, updated_at, priority, csat_score:csat_surveys(score)')
          .eq('assigned_agent_id', agentId)
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end);

        if (error) throw error;

        const totalClaimed = tickets?.length || 0;
        const resolvedCount = tickets?.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length || 0;

        let resolvedHoursSum = 0;
        let resolvedWithTimeCount = 0;
        let slaCompliantCount = 0;
        let reworkCount = 0;

        tickets?.forEach((t) => {
          if (t.created_at && t.updated_at && (t.status === 'Resolved' || t.status === 'Closed')) {
            const hours = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
            resolvedHoursSum += hours;
            resolvedWithTimeCount++;
            const isHighCritical = t.priority === 'Critical' || t.priority === 'High';
            if (isHighCritical && hours <= 4) slaCompliantCount++;
            else if (!isHighCritical && hours <= 24) slaCompliantCount++;
          }
          if (t.status === 'Rejected' || t.status === 'Escalated') {
            reworkCount++;
          }
        });

        const avgResolutionTime = resolvedWithTimeCount > 0 ? parseFloat((resolvedHoursSum / resolvedWithTimeCount).toFixed(1)) : 0;
        const slaComplianceRate = resolvedCount > 0 ? Math.round((slaCompliantCount / resolvedCount) * 100) : 100;
        const reworkRate = totalClaimed > 0 ? Math.round((reworkCount / totalClaimed) * 100) : 0;

        let csatSum = 0;
        let csatCount = 0;

        interface CsatScoreField {
          csat_score?: { score: number }[] | { score: number } | null;
        }

        tickets?.forEach((t) => {
          const scoreData = (t as unknown as CsatScoreField).csat_score;
          const score = Array.isArray(scoreData) ? scoreData[0]?.score : scoreData?.score;
          if (score) {
            csatSum += score;
            csatCount++;
          }
        });
        const avgCsat = csatCount > 0 ? parseFloat((csatSum / csatCount).toFixed(2)) : 0;

        setKpiStats({
          totalClaimed,
          resolvedCount,
          avgResolutionTime,
          slaComplianceRate,
          reworkRate,
          avgCsat,
        });

        setScores({ ...DEFAULT_SCORES });
        setComments('');
        setIsAiGenerated(false);

        const { data: existing } = await supabase
          .from('staff_evaluations_360')
          .select('*')
          .eq('agent_id', agentId)
          .eq('evaluation_period', period)
          .eq('evaluator_role', evaluatorRole)
          .maybeSingle();

        if (existing) {
          setScores({
            system_data_expertise: existing.system_data_expertise || 3,
            troubleshooting_sla: existing.troubleshooting_sla || 3,
            shift_availability: existing.shift_availability || 3,
            handover_quality: existing.handover_quality || 3,
            knowledge_sharing: existing.knowledge_sharing || 3,
            crisis_communication: existing.crisis_communication || 3,
            emotional_regulation: existing.emotional_regulation || 3,
            learning_agility: existing.learning_agility || 3,
          });
          setComments(existing.comments || '');
          setIsAiGenerated(existing.is_ai_generated || false);
        }
      } catch (err) {
        console.error('Error fetching real metrics:', err);
      } finally {
        setLoadingStats(false);
      }
    },
    [dateRange.start, dateRange.end, period, evaluatorRole]
  );

  useEffect(() => {
    if (selectedAgentId) {
      void fetchAgentRealStats(selectedAgentId);
    }
  }, [fetchAgentRealStats, selectedAgentId]);

  const calculations = useMemo(() => {
    const functionalSum = scores.system_data_expertise + scores.troubleshooting_sla;
    const reliabilitySum = scores.shift_availability + scores.handover_quality + scores.knowledge_sharing;
    const commsSum = scores.crisis_communication + scores.emotional_regulation;
    const devSum = scores.learning_agility;

    const functionalAvg = (functionalSum / 10) * 100;
    const reliabilityAvg = (reliabilitySum / 15) * 100;
    const commsAvg = (commsSum / 10) * 100;
    const devAvg = (devSum / 5) * 100;

    const weightedScore = functionalAvg * 0.4 + reliabilityAvg * 0.3 + commsAvg * 0.2 + devAvg * 0.1;

    return {
      functionalAvg: parseFloat(functionalAvg.toFixed(1)),
      reliabilityAvg: parseFloat(reliabilityAvg.toFixed(1)),
      commsAvg: parseFloat(commsAvg.toFixed(1)),
      devAvg: parseFloat(devAvg.toFixed(1)),
      weightedScore: parseFloat(weightedScore.toFixed(1)),
    };
  }, [scores]);

  const handleGenerateAI = async () => {
    if (!selectedAgentId) return;
    setGeneratingAI(true);
    try {
      const res = await fetch('/api/analytics/staff/evaluate-360', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-ai',
          agentId: selectedAgentId,
          startDate: dateRange.start,
          endDate: dateRange.end,
          period,
        }),
      });

      if (!res.ok) throw new Error('AI analysis request failed');
      const result = await res.json();

      if (result.scores) {
        setScores({
          system_data_expertise: result.scores.system_data_expertise || 3,
          troubleshooting_sla: result.scores.troubleshooting_sla || 3,
          shift_availability: result.scores.shift_availability || 3,
          handover_quality: result.scores.handover_quality || 3,
          knowledge_sharing: result.scores.knowledge_sharing || 3,
          crisis_communication: result.scores.crisis_communication || 3,
          emotional_regulation: result.scores.emotional_regulation || 3,
          learning_agility: result.scores.learning_agility || 3,
        });
        setComments(result.comments || '');
        setIsAiGenerated(true);
        addToast({
          id: `ai-eval-ok-${Date.now()}`,
          type: 'ticket',
          title: 'คำนวณและประเมินด้วย AI สำเร็จ',
          body: 'ระบบได้กรอกระดับคะแนนแนะนำและข้อความประเมินเบื้องต้นจากข้อมูลประวัติการทำงานเรียบร้อยแล้ว',
        });
      }
    } catch (err: unknown) {
      console.error(err);
      addToast({
        id: `ai-eval-err-${Date.now()}`,
        type: 'sla_warning',
        title: 'เกิดข้อผิดพลาดในการเรียก AI',
        body: 'ไม่สามารถส่งข้อมูลให้ระบบวิเคราะห์ AI ได้ในขณะนี้',
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSaveEvaluation = async () => {
    if (!selectedAgentId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/analytics/staff/evaluate-360', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          agentId: selectedAgentId,
          startDate: dateRange.start,
          endDate: dateRange.end,
          period,
          evaluatorRole,
          evaluationData: {
            ...scores,
            comments,
            is_ai_generated: isAiGenerated,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save evaluation');

      addToast({
        id: `save-ok-${Date.now()}`,
        type: 'ticket',
        title: 'บันทึกประเมินผลสำเร็จ',
        body: 'บันทึกการประเมินผลพนักงานแบบ 360 องศา ลงฐานข้อมูลเรียบร้อยแล้ว',
      });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูลเพื่อบันทึกประเมิน';
      addToast({
        id: `save-err-${Date.now()}`,
        type: 'sla_warning',
        title: 'บันทึกไม่สำเร็จ',
        body: message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  if (!loading && !hasAccess) {
    return (
      <div className="flex-center" style={{ height: '65vh' }}>
        <Card style={{ maxWidth: 460 }}>
          <CardBody>
            <EmptyState
              icon={<ShieldAlert size={36} color="var(--color-danger)" aria-hidden="true" />}
              title="คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้"
              description="สิทธิ์การเข้าถึงแบบฟอร์มประเมินพนักงาน 360 องศานี้ สำหรับผู้บริหารหรือผู้ดูแลระบบเท่านั้น"
              action={
                <Link href="/analytics" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
                    กลับแดชบอร์ดหลัก
                  </Button>
                </Link>
              }
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.pageStack} style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 48 }}>
      <PageHeader
        title="แบบประเมินผลงานพนักงาน 360 องศา"
        subtitle="ประเมินความสามารถ สมรรถนะ และพฤติกรรมการปฏิบัติงานโดยบูรณาการข้อมูลจริงและ AI"
        actions={
          <Link href="/analytics" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="md" leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
              กลับศูนย์สถิติ
            </Button>
          </Link>
        }
      />

      <Card>
        <CardBody>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, alignItems: 'end' }}>
            <Select
              id="eval360-agent"
              label="พนักงานผู้รับการประเมิน"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
            >
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name} ({staff.role})
                </option>
              ))}
            </Select>

            <Select
              id="eval360-role"
              label="บทบาทผู้ประเมิน"
              value={evaluatorRole}
              onChange={(e) => setEvaluatorRole(e.target.value as 'lead' | 'peer' | 'user' | 'self')}
            >
              <option value="lead">หัวหน้ากะ / ผู้บังคับบัญชา (Lead - น้ำหนัก 40%)</option>
              <option value="peer">เพื่อนร่วมทีมเดียวกัน (Peer - น้ำหนัก 30%)</option>
              <option value="user">ผู้รับบริการ / ลูกค้า (User - น้ำหนัก 20%)</option>
              <option value="self">ประเมินตนเอง (Self-Evaluation - น้ำหนัก 10%)</option>
            </Select>

            <Input
              id="eval360-period"
              type="month"
              label="รอบการประเมินประจำเดือน"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />

            <Button
              variant="secondary"
              size="md"
              onClick={() => selectedAgentId && void fetchAgentRealStats(selectedAgentId)}
              loading={loadingStats}
              leftIcon={<RefreshCw size={16} aria-hidden="true" />}
              fullWidth
            >
              อัปเดตสถิติ
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className={styles.evalLayout}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* AI Autofill Banner */}
          <Card style={{ borderColor: 'var(--color-primary)' }}>
            <CardBody>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 260 }}>
                  <div className={styles.kpiIconBox} style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }} aria-hidden="true">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-text)' }}>
                      ต้องการให้ AI ช่วยประเมินเบื้องต้นจากข้อมูลจริง?
                    </h2>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                      ระบบ AI จะวิเคราะห์สถิติจำนวนใบงาน อัตรา SLA บันทึกการส่งเวร และข้อความสนทนาจริง เพื่อแนะนำระดับคะแนน 1-5 พร้อมบทวิเคราะห์
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleGenerateAI}
                  loading={generatingAI}
                  disabled={loadingStats}
                  leftIcon={<Sparkles size={16} aria-hidden="true" />}
                >
                  {generatingAI ? 'กำลังส่งวิเคราะห์...' : 'วิเคราะห์คะแนนด้วย AI'}
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* 4 Competency Dimensions */}
          <Card>
            <CardHeader>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-text)' }}>
                ระดับความถี่ตัวบ่งชี้พฤติกรรม (คะแนน 1–5)
              </h2>
            </CardHeader>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {/* 1. Functional Competencies */}
                <section>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClipboardList size={16} aria-hidden="true" />
                    1. มิติด้านทักษะเทคนิคและการตอบสนอง (น้ำหนัก 40%)
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className={styles.metricBox}>
                      <div className={styles.metricHeader}>
                        <label htmlFor="score-expertise" className={styles.metricLabel}>
                          1.1 ความรู้ความเชี่ยวชาญการจัดการข้อมูลในระบบ (System & Data Expertise)
                        </label>
                        <span className={styles.metricScore} style={{ color: 'var(--color-primary)' }}>
                          {scores.system_data_expertise} / 5
                        </span>
                      </div>
                      <p className={styles.metricDesc}>
                        ความถูกต้องและทักษะการตรวจสอบความผิดปกติของข้อมูลในโมดูลต่างๆ และการประสานงานกับทีมหน้างานองค์กร/บริษัทได้ครบถ้วน
                      </p>
                      <input
                        id="score-expertise"
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={scores.system_data_expertise}
                        onChange={(e) => setScores((p) => ({ ...p, system_data_expertise: parseInt(e.target.value, 10) }))}
                        className={styles.rangeInput}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <div className={styles.rangeScale}>
                        <span>1 = ไม่เคยปฏิบัติได้เลย</span>
                        <span>3 = ปฏิบัติเป็นบางครั้ง</span>
                        <span>5 = ปฏิบัติได้สม่ำเสมอ</span>
                      </div>
                    </div>

                    <div className={styles.metricBox}>
                      <div className={styles.metricHeader}>
                        <label htmlFor="score-sla" className={styles.metricLabel}>
                          1.2 การสืบค้น ตรวจสอบแก้ไขปัญหา และความถูกต้องตาม SLA (Troubleshooting & SLA)
                        </label>
                        <span className={styles.metricScore} style={{ color: 'var(--color-primary)' }}>
                          {scores.troubleshooting_sla} / 5
                        </span>
                      </div>
                      <p className={styles.metricDesc}>
                        วิเคราะห์หาสาเหตุขัดข้องเชิงลึก แก้ไขปัญหาการเข้าใช้งานระบบได้อย่างทันท่วงที และควบคุมไม่ให้เกิดเคสล่าช้าเกิน SLA
                      </p>
                      <input
                        id="score-sla"
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={scores.troubleshooting_sla}
                        onChange={(e) => setScores((p) => ({ ...p, troubleshooting_sla: parseInt(e.target.value, 10) }))}
                        className={styles.rangeInput}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <div className={styles.rangeScale}>
                        <span>1 = ต่ำกว่ามาตรฐาน</span>
                        <span>3 = ผ่านเกณฑ์มาตรฐาน</span>
                        <span>5 = รวดเร็วระดับสูงสุด</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 2. Shift & Team Reliability */}
                <section>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-success-text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} aria-hidden="true" />
                    2. มิติด้านความน่าเชื่อถือและการทำงานเป็นกะ (น้ำหนัก 30%)
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className={styles.metricBox}>
                      <div className={styles.metricHeader}>
                        <label htmlFor="score-shift" className={styles.metricLabel}>
                          2.1 ความพร้อมในการปฏิบัติงานและการควบคุมเวลาช่วงกะการทำงาน (Shift Availability)
                        </label>
                        <span className={styles.metricScore} style={{ color: 'var(--color-success-text)' }}>
                          {scores.shift_availability} / 5
                        </span>
                      </div>
                      <p className={styles.metricDesc}>
                        ความรับผิดชอบในการปฏิบัติงานเต็มเวลาที่กำหนด ความตรงต่อเวลา และการไม่ละทิ้งหน้าที่โดยไม่มีการแจ้งล่วงหน้า
                      </p>
                      <input
                        id="score-shift"
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={scores.shift_availability}
                        onChange={(e) => setScores((p) => ({ ...p, shift_availability: parseInt(e.target.value, 10) }))}
                        className={styles.rangeInput}
                        style={{ accentColor: 'var(--color-success)' }}
                      />
                    </div>

                    <div className={styles.metricBox}>
                      <div className={styles.metricHeader}>
                        <label htmlFor="score-handover" className={styles.metricLabel}>
                          2.2 คุณภาพในการรับส่งงานข้ามกะและการติดตามงาน (Handover Quality)
                        </label>
                        <span className={styles.metricScore} style={{ color: 'var(--color-success-text)' }}>
                          {scores.handover_quality} / 5
                        </span>
                      </div>
                      <p className={styles.metricDesc}>
                        สรุปประเด็นงานที่ค้างได้ชัดเจน บันทึกรายละเอียดปัญหาอย่างตรงไปตรงมา เพื่อให้พนักงานกะถัดไปดำเนินการต่อได้ทันที
                      </p>
                      <input
                        id="score-handover"
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={scores.handover_quality}
                        onChange={(e) => setScores((p) => ({ ...p, handover_quality: parseInt(e.target.value, 10) }))}
                        className={styles.rangeInput}
                        style={{ accentColor: 'var(--color-success)' }}
                      />
                    </div>

                    <div className={styles.metricBox}>
                      <div className={styles.metricHeader}>
                        <label htmlFor="score-knowledge" className={styles.metricLabel}>
                          2.3 การแบ่งปันองค์ความรู้และการสอนงาน (Knowledge Sharing)
                        </label>
                        <span className={styles.metricScore} style={{ color: 'var(--color-success-text)' }}>
                          {scores.knowledge_sharing} / 5
                        </span>
                      </div>
                      <p className={styles.metricDesc}>
                        การจัดเขียนคู่มือเบื้องต้น (SOP/FAQ) ช่วยเหลือและตอบคำถามเพื่อนร่วมงานด้วยความเต็มใจ เพื่อยกระดับทั้งทีม
                      </p>
                      <input
                        id="score-knowledge"
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={scores.knowledge_sharing}
                        onChange={(e) => setScores((p) => ({ ...p, knowledge_sharing: parseInt(e.target.value, 10) }))}
                        className={styles.rangeInput}
                        style={{ accentColor: 'var(--color-success)' }}
                      />
                    </div>
                  </div>
                </section>

                {/* 3. Communication & Service Mind */}
                <section>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-info-text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageSquare size={16} aria-hidden="true" />
                    3. มิติด้านการสื่อสารและการบริการ (น้ำหนัก 20%)
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className={styles.metricBox}>
                      <div className={styles.metricHeader}>
                        <label htmlFor="score-crisis" className={styles.metricLabel}>
                          3.1 การสื่อสารประสานงานในสภาวะวิกฤตและเร่งด่วน (Crisis Communication)
                        </label>
                        <span className={styles.metricScore} style={{ color: 'var(--color-info-text)' }}>
                          {scores.crisis_communication} / 5
                        </span>
                      </div>
                      <p className={styles.metricDesc}>
                        ให้ข้อมูลที่เป็นประโยชน์ เข้าใจง่าย อัปเดตความคืบหน้าให้ผู้ใช้รับรู้เป็นระยะ และอธิบายแนวทางการหลีกเลี่ยงผลกระทบได้ดี
                      </p>
                      <input
                        id="score-crisis"
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={scores.crisis_communication}
                        onChange={(e) => setScores((p) => ({ ...p, crisis_communication: parseInt(e.target.value, 10) }))}
                        className={styles.rangeInput}
                        style={{ accentColor: 'var(--color-info)' }}
                      />
                    </div>

                    <div className={styles.metricBox}>
                      <div className={styles.metricHeader}>
                        <label htmlFor="score-emotion" className={styles.metricLabel}>
                          3.2 การควบคุมอารมณ์และระดับความสุภาพ (Emotional Regulation)
                        </label>
                        <span className={styles.metricScore} style={{ color: 'var(--color-info-text)' }}>
                          {scores.emotional_regulation} / 5
                        </span>
                      </div>
                      <p className={styles.metricDesc}>
                        การรักษาความสุภาพนอบน้อมทั้งทางแชทและเสียง อดทนต่อความกดดันเมื่อผู้ใช้งานมีสภาวะตึงเครียด
                      </p>
                      <input
                        id="score-emotion"
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={scores.emotional_regulation}
                        onChange={(e) => setScores((p) => ({ ...p, emotional_regulation: parseInt(e.target.value, 10) }))}
                        className={styles.rangeInput}
                        style={{ accentColor: 'var(--color-info)' }}
                      />
                    </div>
                  </div>
                </section>

                {/* 4. Self-Development */}
                <section>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-warning-text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={16} aria-hidden="true" />
                    4. มิติด้านการพัฒนาตนเอง (น้ำหนัก 10%)
                  </h3>
                  <div className={styles.metricBox}>
                    <div className={styles.metricHeader}>
                      <label htmlFor="score-agility" className={styles.metricLabel}>
                        4.1 ความใฝ่รู้และการพัฒนาปรับปรุงกระบวนการทำงาน (Learning Agility)
                      </label>
                      <span className={styles.metricScore} style={{ color: 'var(--color-warning-text)' }}>
                        {scores.learning_agility} / 5
                      </span>
                    </div>
                    <p className={styles.metricDesc}>
                      ความรวดเร็วในการเรียนรู้ฟังก์ชันใหม่ของระบบ ตลอดจนการค้นคว้าพัฒนาเครื่องมือมาช่วยย่นระยะเวลาการตอบสนอง
                    </p>
                    <input
                      id="score-agility"
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={scores.learning_agility}
                      onChange={(e) => setScores((p) => ({ ...p, learning_agility: parseInt(e.target.value, 10) }))}
                      className={styles.rangeInput}
                      style={{ accentColor: 'var(--color-warning)' }}
                    />
                  </div>
                </section>

                <Textarea
                  id="eval360-comments"
                  label="ความคิดเห็นและฟีดแบ็กเพิ่มเติมประกอบประเมินผล"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="ระบุจุดแข็ง สิ่งที่ต้องปรับปรุง หรือข้อแนะนำเพิ่มเติมอย่างสร้างสรรค์เพื่อประกอบคะแนน..."
                  rows={4}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSaveEvaluation}
                    loading={saving}
                    disabled={loadingStats}
                    leftIcon={<Save size={16} aria-hidden="true" />}
                  >
                    {saving ? 'กำลังบันทึกข้อมูล...' : 'บันทึกผลประเมินลงระบบ'}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Sidebar: Weighted Calculator & DB KPIs */}
        <aside className={styles.evalSidebar}>
          <Card>
            <CardHeader>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-text)' }}>
                คะแนนเฉลี่ยถ่วงน้ำหนักรวม
              </h2>
            </CardHeader>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '12px 0 20px' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>คะแนนประเมินเฉลี่ยสุทธิ</span>
                <p className="tabular-nums" style={{ fontSize: 44, fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1.15, margin: '6px 0' }}>
                  {calculations.weightedScore}%
                </p>
                <div style={{ display: 'flex', gap: 3 }} aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => {
                    const active = i < Math.round((calculations.weightedScore / 100) * 5);
                    return (
                      <Star
                        key={i}
                        size={14}
                        fill={active ? 'var(--color-primary)' : 'transparent'}
                        color="var(--color-primary)"
                        style={{ opacity: active ? 1 : 0.25 }}
                      />
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--text-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>1. ความชำนาญและ SLA (40%):</span>
                  <strong className="tabular-nums">{calculations.functionalAvg}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>2. การขึ้นกะและร่วมทีม (30%):</span>
                  <strong className="tabular-nums">{calculations.reliabilityAvg}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>3. สื่อสารและบริการ (20%):</span>
                  <strong className="tabular-nums">{calculations.commsAvg}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>4. การพัฒนาตนเอง (10%):</span>
                  <strong className="tabular-nums">{calculations.devAvg}%</strong>
                </div>
              </div>

              {isAiGenerated ? (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginTop: 16,
                    background: 'var(--color-primary-soft)',
                    border: '1px solid var(--color-border)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-primary)',
                    fontWeight: 600,
                  }}
                >
                  <Bot size={14} aria-hidden="true" />
                  <span>คำนวณคะแนนเบื้องต้นด้วยระบบ AI</span>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color="var(--color-primary)" aria-hidden="true" />
                ประวัติการทำงานจริงในระบบ
              </h2>
            </CardHeader>
            <CardBody>
              {loadingStats ? (
                <div className="flex-center" style={{ padding: '24px 0' }}>
                  <Loader2 className="animate-spin" size={24} color="var(--color-primary)" />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>เคสที่สำเร็จ / เคลมมาทั้งหมด</span>
                    <div className="tabular-nums" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)', marginTop: 2 }}>
                      {kpiStats.resolvedCount}{' '}
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', fontWeight: 500 }}>
                        จากทั้งหมด {kpiStats.totalClaimed} ใบงาน
                      </span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>ความถูกต้องระยะเวลา SLA</span>
                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: 'var(--text-lg)',
                        fontWeight: 700,
                        color: kpiStats.slaComplianceRate >= 80 ? 'var(--color-success-text)' : 'var(--color-danger-text)',
                        marginTop: 2,
                      }}
                    >
                      {kpiStats.slaComplianceRate}%
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>อัตราโดนตีกลับแก้ไขซ้ำ (Rework)</span>
                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: 'var(--text-lg)',
                        fontWeight: 700,
                        color: kpiStats.reworkRate > 20 ? 'var(--color-danger-text)' : 'var(--color-text)',
                        marginTop: 2,
                      }}
                    >
                      {kpiStats.reworkRate}%
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>คะแนนเฉลี่ยลูกค้า CSAT</span>
                    <div className="tabular-nums" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-primary)', marginTop: 2 }}>
                      {kpiStats.avgCsat > 0 ? `${kpiStats.avgCsat} / 5` : 'ไม่มีคะแนน'}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertCircle size={14} color="var(--color-text-muted)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', lineHeight: 1.5 }}>
                      ข้อมูล KPI สถิติจริงดึงจากประวัติการเคลียร์ใบงานในช่วงวันที่ {dateRange.start} ถึง {dateRange.end}
                    </p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
