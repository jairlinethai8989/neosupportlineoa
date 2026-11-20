'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import { getSurveyTicketAction, submitSurveyAction } from '@/app/actions/portalActions';
import {
  Star,
  Send,
  CheckCircle,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import styles from '@/app/portal/portal.module.css';

const RATING_LABELS: Record<number, string> = {
  1: 'ควรปรับปรุง',
  2: 'พอใช้',
  3: 'ดี',
  4: 'ดีมาก',
  5: 'ยอดเยี่ยมที่สุด',
};

export default function SurveyPage() {
  const { id } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [existingScore, setExistingScore] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function fetchTicket() {
      const result = await getSurveyTicketAction(String(id || ''));
      if (result.ticket) setTicket(result.ticket);
      if (result.alreadySubmitted) {
        setAlreadySubmitted(true);
        setExistingScore(result.existingScore);
        setCompleted(true);
      }
      setLoading(false);
    }
    if (id) void fetchTicket();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score === 0) {
      setErrorMsg('กรุณาให้คะแนนความพึงพอใจ 1 ถึง 5 ดาว');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const result = await submitSurveyAction(String(id || ''), score, comment);
      if (result.alreadySubmitted) {
        setAlreadySubmitted(true);
        setCompleted(true);
        return;
      }
      if (!result.success) {
        setErrorMsg(result.error || 'ไม่สามารถบันทึกการประเมินได้');
        return;
      }
      setCompleted(true);
    } catch (err: any) {
      console.error('Survey error:', err);
      setErrorMsg(`ไม่สามารถบันทึกข้อมูลได้: ${err.message || 'ปัญหาการเชื่อมต่อ'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.screen} role="status" aria-label="กำลังโหลดแบบประเมิน">
        <Loader2 className={styles.spin} size={32} color="var(--pt-accent)" aria-hidden="true" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className={styles.screen}>
        <div className={clsx(styles.screenInner, styles.surveyCard, styles.centerText)} role="alert">
          <h1 className={styles.surveyTitle}>ไม่พบข้อมูลการประเมิน</h1>
          <p className={styles.surveyDesc}>
            ลิงก์นี้อาจจะไม่ถูกต้อง หรือใบงานนี้ไม่สามารถประเมินได้แล้ว
          </p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className={styles.screen}>
        <div className={clsx(styles.screenInner, styles.surveyCard, styles.centerText)}>
          <CheckCircle size={56} className={styles.successIcon} aria-hidden="true" />
          <h1 className={styles.surveyTitle}>
            {alreadySubmitted ? 'ประเมินเรียบร้อยแล้ว' : 'ขอบคุณสำหรับคะแนนประเมิน'}
          </h1>
          <p className={styles.surveyDesc} style={{ marginBottom: 24 }}>
            {alreadySubmitted
              ? `ใบงานหมายเลข #${ticket?.ticket_no || ''} ได้รับการบันทึกผลประเมินแล้ว${existingScore ? ` (${existingScore}/5 ดาว)` : ''} ขอบคุณสำหรับความคิดเห็นครับ`
              : 'ความคิดเห็นของคุณมีค่าสำหรับเรามาก เพื่อนำไปปรับปรุงการบริการให้ดียิ่งขึ้นครับ'}
          </p>
          <button
            type="button"
            onClick={() => window.close()}
            className={clsx(styles.btn, styles.btnPrimary, styles.btnBlock)}
          >
            เรียบร้อย
          </button>
        </div>
      </div>
    );
  }

  const activeScore = hover || score;

  return (
    <div className={styles.screen}>
      <main className={styles.screenInner}>
        <div className={styles.surveyCard}>
          <div className={styles.surveyHead}>
            <span className={styles.dialogIcon} aria-hidden="true">
              <ShieldCheck size={28} />
            </span>
            <h1 className={styles.surveyTitle}>ประเมินการบริการ</h1>
            <p className={styles.surveyDesc}>
              {ticket.customers?.display_name ? `คุณ ${ticket.customers.display_name} • ` : ''}
              ช่วยให้คะแนนการแก้ไขงานหมายเลข{' '}
              <strong className={styles.tabular}>#{ticket.ticket_no}</strong>
            </p>
            {ticket.module && (
              <p className={styles.surveyDesc} style={{ marginTop: 8 }}>
                ระบบที่เกี่ยวข้อง: <span className={styles.surveyModule}>{ticket.module}</span>
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {errorMsg && (
              <div className={clsx(styles.notice, styles.noticeError)} role="alert">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className={styles.field}>
              <span id="survey-rating-label" className={clsx(styles.label, styles.centerText)}>
                ความพึงพอใจในภาพรวม<span className={styles.required}>*</span>
              </span>
              <div
                role="radiogroup"
                aria-labelledby="survey-rating-label"
                className={styles.stars}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={score === star}
                    aria-label={`${star} ดาว - ${RATING_LABELS[star]}`}
                    className={clsx(styles.star, activeScore >= star && styles.starOn)}
                    onClick={() => {
                      setScore(star);
                      if (errorMsg) setErrorMsg('');
                    }}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                  >
                    <Star size={36} strokeWidth={2} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div className={styles.ratingLabel} aria-live="polite">
                {RATING_LABELS[score] || 'แตะที่ดาวเพื่อเลือกคะแนน'}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="survey-comment" className={styles.label}>
                ข้อเสนอแนะเพิ่มเติม (ถ้ามี)
              </label>
              <textarea
                id="survey-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="บอกเราได้ครับว่าชอบส่วนไหน หรืออยากให้เราปรับปรุงอะไร..."
                className={styles.textarea}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || score === 0}
              className={clsx(styles.btn, styles.btnPrimary, styles.btnBlock)}
            >
              {submitting ? (
                <>
                  <Loader2 className={styles.spin} size={20} aria-hidden="true" />
                  กำลังส่งแบบประเมิน...
                </>
              ) : (
                <>
                  ส่งแบบประเมิน
                  <Send size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <p className={styles.surveyFooter}>
            ข้อมูลของคุณจะถูกนำไปพัฒนาการบริการให้ดียิ่งขึ้น
          </p>
        </div>
      </main>
    </div>
  );
}
