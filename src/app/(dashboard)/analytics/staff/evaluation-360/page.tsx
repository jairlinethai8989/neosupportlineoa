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
  Award,
  AlertCircle,
  TrendingUp,
  Activity,
  MessageSquare,
  ClipboardList
} from 'lucide-react';
import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';

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
  learning_agility: 3
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
  
  // Scores & comments
  const [scores, setScores] = useState<EvaluationScores>({ ...DEFAULT_SCORES });
  const [comments, setComments] = useState<string>('');
  const [isAiGenerated, setIsAiGenerated] = useState<boolean>(false);

  // Stats view
  const [kpiStats, setKpiStats] = useState({
    totalClaimed: 0,
    resolvedCount: 0,
    avgResolutionTime: 0,
    slaComplianceRate: 0,
    reworkRate: 0,
    avgCsat: 0
  });

  const [dateRange] = useState({
    start: DateTime.now().minus({ days: 30 }).toISODate()!,
    end: DateTime.now().toISODate()!
  });

  // Calculate default period based on dates
  useEffect(() => {
    const startDT = DateTime.fromISO(dateRange.start);
    setPeriod(`${startDT.toFormat('yyyy-MM')}`);
  }, [dateRange]);

  // Security authorization check
  const hasAccess = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'Administrator') return true;
    return userProfile.permissions?.analytics_staff === 'view' || userProfile.permissions?.analytics_staff === 'edit';
  }, [userProfile]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch all staff members
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

  // Query performance stats from DB
  const fetchAgentRealStats = useCallback(async (agentId: string) => {
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
      const resolvedCount = tickets?.filter(t => t.status === 'Resolved' || t.status === 'Closed').length || 0;
      
      let resolvedHoursSum = 0;
      let resolvedWithTimeCount = 0;
      let slaCompliantCount = 0;
      let reworkCount = 0;

      tickets?.forEach(t => {
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

      tickets?.forEach(t => {
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
        avgCsat
      });

      // Reset score defaults or fetch existing eval
      setScores({ ...DEFAULT_SCORES });
      setComments('');
      setIsAiGenerated(false);
      
      // Attempt to load existing evaluation
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
          learning_agility: existing.learning_agility || 3
        });
        setComments(existing.comments || '');
        setIsAiGenerated(existing.is_ai_generated || false);
      }
    } catch (err) {
      console.error('Error fetching real metrics:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [dateRange.start, dateRange.end, period, evaluatorRole]);

  useEffect(() => {
    if (selectedAgentId) {
      void fetchAgentRealStats(selectedAgentId);
    }
  }, [fetchAgentRealStats, selectedAgentId]);

  // 360-Degree Weightings Calculator
  // Functional: 40% (Expertise + SLA) -> 20% each
  // Reliability: 30% (Shift + Handover + Knowledge) -> 10% each
  // Communication: 20% (Crisis + Emotional) -> 10% each
  // Self-Development: 10% (Learning Agility) -> 10%
  const calculations = useMemo(() => {
    const functionalSum = scores.system_data_expertise + scores.troubleshooting_sla;
    const reliabilitySum = scores.shift_availability + scores.handover_quality + scores.knowledge_sharing;
    const commsSum = scores.crisis_communication + scores.emotional_regulation;
    const devSum = scores.learning_agility;

    // Convert 1-5 to percentage
    const functionalAvg = (functionalSum / 10) * 100;
    const reliabilityAvg = (reliabilitySum / 15) * 100;
    const commsAvg = (commsSum / 10) * 100;
    const devAvg = (devSum / 5) * 100;

    const weightedScore = (functionalAvg * 0.4) + (reliabilityAvg * 0.3) + (commsAvg * 0.2) + (devAvg * 0.1);

    return {
      functionalAvg: parseFloat(functionalAvg.toFixed(1)),
      reliabilityAvg: parseFloat(reliabilityAvg.toFixed(1)),
      commsAvg: parseFloat(commsAvg.toFixed(1)),
      devAvg: parseFloat(devAvg.toFixed(1)),
      weightedScore: parseFloat(weightedScore.toFixed(1))
    };
  }, [scores]);

  // Request AI Autofill recommendation
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
          period
        })
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
          learning_agility: result.scores.learning_agility || 3
        });
        setComments(result.comments || '');
        setIsAiGenerated(true);
        addToast({
          id: `ai-eval-ok-${Date.now()}`,
          type: 'ticket',
          title: 'คำนวณและประเมินด้วย AI สำเร็จ',
          body: 'ระบบได้กรอกระดับคะแนนแนะนำและข้อความประเมินเบื้องต้นจากข้อมูลประวัติการทำงานเรียบร้อยแล้ว'
        });
      }
    } catch (err: unknown) {
      console.error(err);
      addToast({
        id: `ai-eval-err-${Date.now()}`,
        type: 'sla_warning',
        title: 'เกิดข้อผิดพลาดในการเรียก AI',
        body: 'ไม่สามารถส่งข้อมูลให้ระบบวิเคราะห์ AI ได้ในขณะนี้'
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  // Save the evaluation record
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
            is_ai_generated: isAiGenerated
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save evaluation');

      addToast({
        id: `save-ok-${Date.now()}`,
        type: 'ticket',
        title: 'บันทึกประเมินผลสำเร็จ',
        body: 'บันทึกการประเมินผลพนักงานแบบ 360 องศา ลงฐานข้อมูลเรียบร้อยแล้ว'
      });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูลเพื่อบันทึกประเมิน';
      addToast({
        id: `save-err-${Date.now()}`,
        type: 'sla_warning',
        title: 'บันทึกไม่สำเร็จ',
        body: message
      });
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  if (!loading && !hasAccess) {
    return (
      <div className="flex-center" style={{ height: '70vh', animation: 'fadeIn 0.5s ease-out' }}>
        <div className="glass" style={{ maxWidth: '480px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(234, 84, 85, 0.1)', padding: '16px', borderRadius: '50%', color: 'var(--danger)' }}>
            <ShieldAlert size={48} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)' }}>คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            สิทธิ์การเข้าถึงแบบฟอร์มประเมินพนักงาน 360 องศานี้ สำหรับผู้บริหารหรือผู้ดูแลระบบเท่านั้น
          </p>
          <Link href="/analytics/staff" className="glass-interactive" style={{ padding: '12px 24px', background: 'var(--primary)', color: '#0a0e14', fontWeight: '800', borderRadius: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeft size={16} /> กลับแดชบอร์ดหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out', maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <Link href="/analytics/staff" className="glass-interactive" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '12px', color: 'var(--text-muted)' }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={24} color="var(--primary)" />
            <span>แบบประเมินผลงานพนักงาน 360 องศา (360° Staff Evaluation)</span>
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            ประเมินความสามารถ สมรรถนะ และพฤติกรรมการปฏิบัติงานโดยบูรณาการข้อมูลจริงและ AI
          </p>
        </div>
      </div>

      {/* Selectors and Configuration Panel */}
      <div className="glass" style={{ padding: '20px 24px', marginBottom: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'end' }}>
          
          {/* Employee */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>พนักงานผู้รับการประเมิน</label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: 'var(--text-main)',
                fontWeight: '700',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name} ({staff.role})
                </option>
              ))}
            </select>
          </div>

          {/* Evaluator Role */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>บทบาทผู้ประเมิน</label>
            <select
              value={evaluatorRole}
              onChange={(e) => setEvaluatorRole(e.target.value as 'lead' | 'peer' | 'user' | 'self')}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: 'var(--text-main)',
                fontWeight: '700',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="lead">หัวหน้ากะ / ผู้บังคับบัญชา (Lead - น้ำหนัก 40%)</option>
              <option value="peer">เพื่อนร่วมทีมเดียวกัน (Peer - น้ำหนัก 30%)</option>
              <option value="user">ผู้รับบริการ / ลูกค้า (User - น้ำหนัก 20%)</option>
              <option value="self">ประเมินตนเอง (Self-Evaluation - น้ำหนัก 10%)</option>
            </select>
          </div>

          {/* Range Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>รอบการประเมินประจำเดือน/รอบระยะเวลา</label>
            <input 
              type="month" 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '9px 14px',
                color: 'var(--text-main)',
                fontWeight: '700',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => selectedAgentId && void fetchAgentRealStats(selectedAgentId)}
              className="glass-interactive flex-center"
              style={{ height: '40px', padding: '0 16px', borderRadius: '10px', border: '1px solid var(--border)', color: 'var(--text-muted)', flex: 1 }}
            >
              {loadingStats ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              <span style={{ fontSize: '12px', fontWeight: '700', marginLeft: '6px' }}>อัปเดตสถิติ</span>
            </button>
          </div>

        </div>
      </div>

      {/* Main Grid: Left side for form, Right side for Stats & weighted calculator */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Side: Forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* AI Autofill Banner */}
          <div className="glass" style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)', border: '1px solid rgba(0, 242, 254, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: '1', minWidth: '280px' }}>
              <div style={{ background: 'rgba(0, 242, 254, 0.12)', padding: '10px', borderRadius: '12px', color: 'var(--primary)', flexShrink: 0 }}>
                <Bot size={22} className="animate-pulse-subtle" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>ต้องการให้ AI ช่วยประเมินเบื้องต้นจากข้อมูลจริง?</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  ระบบ AI จะวิเคราะห์สถิติจำนวนใบงาน อัตรา SLA บันทึกการส่งเวร (Log) และข้อความที่คุยจริงกับบุคลากรทางการแพทย์ เพื่อแนะนำระดับคะแนน 1-5 พร้อมบทวิเคราะห์ประกอบ
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateAI}
              disabled={generatingAI || loadingStats}
              className="glass-interactive flex-center"
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.9) 0%, rgba(115, 103, 240, 0.9) 100%)',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '12px',
                border: 'none',
                boxShadow: '0 4px 15px rgba(0, 242, 254, 0.15)',
                cursor: (generatingAI || loadingStats) ? 'not-allowed' : 'pointer'
              }}
            >
              {generatingAI ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span style={{ marginLeft: '6px' }}>กำลังส่งวิเคราะห์...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span style={{ marginLeft: '6px' }}>วิเคราะห์คะแนนด้วย AI จากข้อมูลจริง</span>
                </>
              )}
            </button>
          </div>

          {/* Form Content - 4 Competency Dimensions */}
          <div className="glass" style={{ padding: '24px 30px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '24px' }}>
              ระดับความถี่ตัวบ่งชี้พฤติกรรม (Frequency Rating Scale: 1-5)
            </h2>

            {/* 1. Functional Competencies */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={16} /> 1. มิติด้านทักษะเทคนิคและการตอบสนอง (Functional Competencies - น้ำหนัก 40%)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Metric 1 */}
                <div className="glass" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>1.1 ความรู้ความเชี่ยวชาญการจัดการข้อมูลในระบบ NEOHOS IPD (System & Data Expertise)</span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--primary)' }}>{scores.system_data_expertise} / 5</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    ความถูกต้องและทักษะการตรวจสอบความผิดปกติของข้อมูลในโมดูลต่างๆ เช่น Admit, Doctor Order, Medication, Transfer, Billing และการประสานงานกับทีมหน้างานโรงพยาบาลได้ครบถ้วน
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={scores.system_data_expertise}
                    onChange={(e) => setScores(p => ({ ...p, system_data_expertise: parseInt(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                    <span>1 = ไม่เคยปฏิบัติได้เลย (Never)</span>
                    <span>3 = ปฏิบัติเป็นบางครั้ง (Sometimes)</span>
                    <span>5 = ปฏิบัติได้อย่างสมบูรณ์สม่ำเสมอ (Always)</span>
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="glass" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>1.2 การสืบค้น ตรวจสอบแก้ไขปัญหา และความถูกต้องตาม SLA (Troubleshooting & SLA Compliance)</span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--primary)' }}>{scores.troubleshooting_sla} / 5</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    วิเคราะห์หาสาเหตุขัดข้องเชิงลึก แก้ไขปัญหาการเข้าใช้งานระบบได้อย่างทันท่วงทีตามลำดับความจำเป็น และควบคุมไม่ให้เกิดเคสเคลียร์ช้าเกินกำหนดระยะเวลา SLA ของระบบบริการสาธารณสุข
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={scores.troubleshooting_sla}
                    onChange={(e) => setScores(p => ({ ...p, troubleshooting_sla: parseInt(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                    <span>1 = ต่ำกว่ามาตรฐาน / ล่าช้ามาก</span>
                    <span>3 = ผ่านเกณฑ์มาตรฐานส่วนใหญ่</span>
                    <span>5 = รวดเร็วและรักษาสัญญาระดับสูงสุด</span>
                  </div>
                </div>

              </div>
            </div>

            {/* 2. Shift & Team Reliability */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} /> 2. มิติด้านความน่าเชื่อถือและการทำงานเป็นกะ (Shift & Team Reliability - น้ำหนัก 30%)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Metric 3 */}
                <div className="glass" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>2.1 ความพร้อมในการปฏิบัติงานและการควบคุมเวลาช่วงกะการทำงาน (Shift Availability)</span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--success)' }}>{scores.shift_availability} / 5</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    ความรับผิดชอบในการปฏิบัติงานเต็มเวลาที่กำหนดช่วงเวรเช้า บ่าย ดึก หรือเวรฉุกเฉิน 24 ชั่วโมง ความตรงต่อเวลา และการไม่ละทิ้งหน้าที่โดยไม่มีการแจ้งล่วงหน้า
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={scores.shift_availability}
                    onChange={(e) => setScores(p => ({ ...p, shift_availability: parseInt(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--success)', cursor: 'pointer' }}
                  />
                </div>

                {/* Metric 4 */}
                <div className="glass" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>2.2 คุณภาพในการรับส่งงานข้ามกะและการติดตามงาน (Handover Quality)</span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--success)' }}>{scores.handover_quality} / 5</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    สรุปประเด็นงานที่ค้างได้ชัดเจน บันทึกรายละเอียดปัญหาอย่างตรงไปตรงมา และไม่ปัดความรับผิดชอบเพื่อให้พนักงานกะถัดไปแก้ไขโดยปราศจากข้อมูลเบื้องต้น
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={scores.handover_quality}
                    onChange={(e) => setScores(p => ({ ...p, handover_quality: parseInt(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--success)', cursor: 'pointer' }}
                  />
                </div>

                {/* Metric 5 */}
                <div className="glass" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>2.3 การแบ่งปันองค์ความรู้และการสอนงาน (Knowledge Sharing)</span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--success)' }}>{scores.knowledge_sharing} / 5</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    การจัดเขียนคู่มือเบื้องต้น (SOP/FAQ) ช่วยเหลือและตอบคำถามเพื่อนร่วมงานด้วยความเต็มใจ เพื่อยกระดับความสามารถในการแก้ไขตั๋วของทั้งทีมให้สูงขึ้น
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={scores.knowledge_sharing}
                    onChange={(e) => setScores(p => ({ ...p, knowledge_sharing: parseInt(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--success)', cursor: 'pointer' }}
                  />
                </div>

              </div>
            </div>

            {/* 3. Communication & Service Mind */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={16} /> 3. มิติด้านการสื่อสารและการบริการจิตวิญญาณ (Communication & Service Mind - น้ำหนัก 20%)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Metric 6 */}
                <div className="glass" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>3.1 การสื่อสารประสานงานในสภาวะวิกฤตและเร่งด่วน (Crisis Communication)</span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--secondary)' }}>{scores.crisis_communication} / 5</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    ให้ข้อมูลที่เป็นประโยชน์ เข้าใจง่าย ไม่ซับซ้อน อัปเดตความคืบหน้าให้ผู้ใช้ในโรงพยาบาลรับรู้เป็นระยะ และอธิบายแนวทางการหลีกเลี่ยงผลกระทบเชิงลึกได้ดีเยี่ยม
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={scores.crisis_communication}
                    onChange={(e) => setScores(p => ({ ...p, crisis_communication: parseInt(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--secondary)', cursor: 'pointer' }}
                  />
                </div>

                {/* Metric 7 */}
                <div className="glass" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>3.2 การควบคุมอารมณ์และระดับความสุภาพ (Emotional Regulation)</span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--secondary)' }}>{scores.emotional_regulation} / 5</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    การรักษาความสุภาพนอบน้อมทั้งทางแชทและเสียง อดทนต่อความกดดันเมื่อผู้ใช้งานโรงพยาบาลมีสภาวะอารมณ์ตึงเครียดเนื่องจากระบบ Admit/Billing ขัดข้อง
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={scores.emotional_regulation}
                    onChange={(e) => setScores(p => ({ ...p, emotional_regulation: parseInt(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--secondary)', cursor: 'pointer' }}
                  />
                </div>

              </div>
            </div>

            {/* 4. Self-Development */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#ff9f43', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} /> 4. มิติด้านการพัฒนาตนเอง (Self-Development - น้ำหนัก 10%)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Metric 8 */}
                <div className="glass" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>4.1 ความใฝ่รู้และการพัฒนาปรับปรุงกระบวนการทำงาน (Learning Agility)</span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: '#ff9f43' }}>{scores.learning_agility} / 5</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    ความรวดเร็วในการเรียนรู้ฟังก์ชันการอัปเกรดใหม่ของ NEOHOS IPD ตลอดจนการค้นคว้าพัฒนาเครื่องมืออัตโนมัติมาช่วยย่นระยะเวลาการตอบสนองความช่วยเหลือ
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={scores.learning_agility}
                    onChange={(e) => setScores(p => ({ ...p, learning_agility: parseInt(e.target.value) }))}
                    style={{ width: '100%', accentColor: '#ff9f43', cursor: 'pointer' }}
                  />
                </div>

              </div>
            </div>

            {/* Comments input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>ความคิดเห็นและฟีดแบ็กเพิ่มเติมประกอบประเมินผล</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="ระบุจุดแข็ง สิ่งที่ต้องปรับปรุง หรือข้อแนะนำเพิ่มเติมอย่างสร้างสรรค์เพื่อประกอบคะแนน..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '14px',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  outline: 'none',
                  lineHeight: '1.6',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Actions button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <button
                onClick={handleSaveEvaluation}
                disabled={saving || loadingStats}
                className="glass-interactive flex-center"
                style={{
                  padding: '12px 28px',
                  borderRadius: '12px',
                  background: 'var(--primary)',
                  color: '#0a0e14',
                  fontWeight: '800',
                  fontSize: '13px',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(0, 242, 254, 0.2)',
                  cursor: (saving || loadingStats) ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span style={{ marginLeft: '8px' }}>กำลังบันทึกข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span style={{ marginLeft: '8px' }}>บันทึกผลประเมินลงระบบ</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

        {/* Right Side: KPI Stats Preview & Score Calculator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '24px' }}>
          
          {/* Real-time Weighted Calculator */}
          <div className="glass" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
            
            {/* Background glowing aura */}
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '150px', height: '150px', background: 'rgba(0, 242, 254, 0.1)', filter: 'blur(30px)', borderRadius: '50%' }} />

            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '16px' }}>
              คะแนนเฉลี่ยถ่วงน้ำหนักรวม (Calculated Weighted)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>คะแนนประเมินเฉลี่ยสุทธิ</span>
              <h2 style={{ fontSize: '48px', fontWeight: '950', color: 'var(--primary)', textShadow: '0 0 10px rgba(0,242,254,0.3)', margin: '6px 0 2px 0' }}>
                {calculations.weightedScore}%
              </h2>
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: 5 }, (_, i) => {
                  const active = i < Math.round((calculations.weightedScore / 100) * 5);
                  return (
                    <Star 
                      key={i} 
                      size={14} 
                      fill={active ? 'var(--primary)' : 'transparent'} 
                      color="var(--primary)" 
                      style={{ opacity: active ? 1 : 0.2 }}
                    />
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>1. ความชำนาญและ SLA (40%):</span>
                <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{calculations.functionalAvg}%</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>2. การขึ้นกะและร่วมทีม (30%):</span>
                <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{calculations.reliabilityAvg}%</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>3. สื่อสารและบริการ (20%):</span>
                <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{calculations.commsAvg}%</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>4. การพัฒนาตนเอง (10%):</span>
                <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{calculations.devAvg}%</span>
              </div>

            </div>

            {isAiGenerated && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '16px', background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.15)', padding: '8px 10px', borderRadius: '8px', fontSize: '11px', color: 'var(--primary)' }}>
                <Bot size={14} />
                <span>คำนวณคะแนนเบื้องต้นด้วยระบบ AI</span>
              </div>
            )}

          </div>

          {/* Real Database KPI Metrics */}
          <div className="glass" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} color="var(--primary)" />
              <span>ประวัติการทำงานจริงในระบบ</span>
            </h3>

            {loadingStats ? (
              <div className="flex-center" style={{ padding: '30px 0' }}>
                <Loader2 className="animate-spin" size={24} color="var(--primary)" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>เคสที่สำเร็จ / เคลมมาทั้งหมด</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                    {kpiStats.resolvedCount} <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>จากทั้งหมด {kpiStats.totalClaimed} ใบงาน</span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ความถูกต้องระยะเวลา SLA</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: kpiStats.slaComplianceRate >= 80 ? 'var(--success)' : 'var(--danger)', marginTop: '2px' }}>
                    {kpiStats.slaComplianceRate}%
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>อัตราโดนตีกลับแก้ไขซ้ำ (Rework)</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: kpiStats.reworkRate > 20 ? 'var(--danger)' : 'var(--text-main)', marginTop: '2px' }}>
                    {kpiStats.reworkRate}%
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>คะแนนเฉลี่ยลูกค้า CSAT</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {kpiStats.avgCsat > 0 ? `${kpiStats.avgCsat} / 5` : 'ไม่มีคะแนน'}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertCircle size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '10px', color: 'var(--text-dim)', margin: 0, lineHeight: '1.4' }}>
                    ข้อมูล KPI สถิติจริงดึงจากประวัติการเคลียร์ใบงานโมดูลโรงพยาบาลในช่วงวันที่ {dateRange.start} ถึง {dateRange.end}
                  </p>
                </div>

              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
