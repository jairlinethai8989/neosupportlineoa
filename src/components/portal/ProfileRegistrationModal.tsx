'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  ArrowRight,
  ChevronDown,
  Info,
} from 'lucide-react';
import { LiffProfile, PortalOrgOption } from '@/hooks/useLiff';
import type { ProjectPublicConfig } from '@/types/project';
import styles from '@/app/portal/portal.module.css';

interface ProfileRegistrationModalProps {
  isOpen: boolean;
  profile: LiffProfile | null;
  projectConfig?: ProjectPublicConfig | null;
  projectOrganizations?: PortalOrgOption[];
  existingCustomer?: any; // If null, user needs registration. If exists, user is editing.
  onComplete: () => void;
  onClose?: () => void; // Optional: Only for closing when editing
}

export default function ProfileRegistrationModal({
  isOpen,
  profile,
  projectConfig,
  projectOrganizations,
  existingCustomer,
  onComplete,
  onClose,
}: ProfileRegistrationModalProps) {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  const [displayName, setDisplayName] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Fetch Master Data (scoped to project when available)
  useEffect(() => {
    if (!isOpen) return;

    async function loadMasterData() {
      setLoadingOpts(true);
      setError('');
      try {
        const realProjectId =
          projectConfig?.id && projectConfig.id !== 'default-env-fallback'
            ? projectConfig.id
            : null;

        let orgQuery = supabase.from('organizations').select('*').order('name');
        if (realProjectId) {
          orgQuery = orgQuery.eq('project_id', realProjectId);
        }

        const [hRes, dRes, pRes] = await Promise.all([
          projectOrganizations && projectOrganizations.length > 0
            ? Promise.resolve({ data: projectOrganizations, error: null })
            : orgQuery,
          supabase
            .from('departments')
            .select('*')
            .eq('dept_type', 'organization')
            .eq('is_active', true)
            .order('name'),
          supabase.from('positions').select('*').order('name'),
        ]);

        if (hRes.error) console.error('H-Err:', hRes.error);
        if (dRes.error) console.error('D-Err:', dRes.error);
        if (pRes.error) console.error('P-Err:', pRes.error);

        if (hRes.data) setOrganizations(hRes.data);
        if (dRes.data) setDepartments(dRes.data);
        if (pRes.data) setPositions(pRes.data);

        if (hRes.data?.length === 0) {
          console.warn('Organizations table is empty for public/anon user.');
        }

        if (existingCustomer) {
          setDisplayName(existingCustomer.display_name || '');
          setSelectedHospital(existingCustomer.organization_id || '');
          setSelectedDept(existingCustomer.department_id || '');
          setSelectedPosition(existingCustomer.position_id || '');
        } else if (profile?.displayName) {
          setDisplayName(profile.displayName);
        }
      } catch (err: any) {
        console.error('Failed to load master data:', err);
      } finally {
        setLoadingOpts(false);
      }
    }
    loadMasterData();
  }, [isOpen, existingCustomer, profile, projectConfig?.id, projectOrganizations]);

  const isEditing = Boolean(existingCustomer?.organization_id);
  const canDismiss = isEditing && Boolean(existingCustomer?.organization_id) && Boolean(onClose);

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
    if (!canDismiss || !onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, canDismiss, onClose, submitting]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.userId) {
      setError('ไม่พบข้อมูลโปรไฟล์ LINE กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      return;
    }

    if (!displayName.trim() || !selectedHospital || !selectedDept || !selectedPosition) {
      setError('กรุณาระบุข้อมูลส่วนตัวให้ครบถ้วนก่อนเริ่มต้นใช้งาน');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const realProjectId =
        projectConfig?.id && projectConfig.id !== 'default-env-fallback'
          ? projectConfig.id
          : null;

      const payload: any = {
        line_user_id: profile.userId,
        display_name: displayName, // Keep as primary display name
        full_name: displayName,    // Store as dedicated real name field
        line_username: profile.displayName || null, // Store LINE nickname
        organization_id: selectedHospital,
        department_id: selectedDept,
        position_id: selectedPosition,
        updated_at: new Date().toISOString(),
      };
      if (realProjectId) {
        payload.project_id = realProjectId;
      }

      // Check existing customer scoped by project_id to handle composite unique index cleanly
      let targetCustomerId = existingCustomer?.id || null;
      if (!targetCustomerId) {
        let lookup = supabase
          .from('customers')
          .select('id')
          .eq('line_user_id', profile.userId);
        if (realProjectId) {
          lookup = lookup.eq('project_id', realProjectId);
        }
        const { data: found } = await lookup.limit(1).maybeSingle();
        targetCustomerId = found?.id || null;
      }

      let saveErr = null;
      if (targetCustomerId) {
        const res = await supabase.from('customers').update(payload).eq('id', targetCustomerId);
        saveErr = res.error;
      } else {
        const res = await supabase.from('customers').insert([payload]);
        saveErr = res.error;
      }

      if (saveErr) throw saveErr;

      onComplete();
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const accentStyle = projectConfig?.primary_color
    ? ({ '--portal-accent': projectConfig.primary_color } as React.CSSProperties)
    : undefined;
  const orgLabel = projectConfig?.organization_label || 'หน่วยงาน / โรงพยาบาล';

  return (
    <div className={styles.overlay} style={accentStyle}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-reg-title"
        tabIndex={-1}
      >
        <div className={styles.dialogHead}>
          <h2 id="profile-reg-title" className={styles.dialogTitle}>
            {isEditing ? 'แก้ไขข้อมูลส่วนตัว' : 'ลงทะเบียนผู้ใช้งานใหม่'}
          </h2>
          <p className={styles.dialogText}>
            กรุณาระบุข้อมูลของคุณเพื่อเริ่มต้นแจ้งปัญหาการใช้งาน
          </p>
        </div>

        {error && (
          <div className={clsx(styles.notice, styles.noticeError)} role="alert">
            <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Full Name */}
          <div className={styles.field}>
            <label htmlFor="reg-display-name" className={styles.label}>
              ชื่อ-นามสกุล<span className={styles.required}>*</span>
            </label>
            <input
              id="reg-display-name"
              type="text"
              placeholder="ระบุชื่อจริง-นามสกุล..."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          {/* Organization Select */}
          <div className={styles.field}>
            <label htmlFor="reg-organization" className={styles.label}>
              {orgLabel}
              <span className={styles.required}>*</span>
            </label>
            <div className={styles.selectWrap}>
              <select
                id="reg-organization"
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                disabled={loadingOpts || submitting}
                className={styles.select}
                required
              >
                <option value="" disabled>
                  โปรดเลือก{projectConfig?.organization_label || 'หน่วยงาน'}...
                </option>
                {organizations.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className={styles.selectChevron} aria-hidden="true" />
            </div>
          </div>

          {/* Department Select */}
          <div className={styles.field}>
            <label htmlFor="reg-department" className={styles.label}>
              แผนก / ฝ่าย<span className={styles.required}>*</span>
            </label>
            <div className={styles.selectWrap}>
              <select
                id="reg-department"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                disabled={loadingOpts || submitting}
                className={styles.select}
                required
              >
                <option value="" disabled>
                  เลือกแผนก...
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className={styles.selectChevron} aria-hidden="true" />
            </div>
          </div>

          {/* Position Select */}
          <div className={styles.field}>
            <label htmlFor="reg-position" className={styles.label}>
              ตำแหน่งงาน<span className={styles.required}>*</span>
            </label>
            <div className={styles.selectWrap}>
              <select
                id="reg-position"
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                disabled={loadingOpts || submitting}
                className={styles.select}
                required
              >
                <option value="" disabled>
                  เลือกตำแหน่ง...
                </option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className={styles.selectChevron} aria-hidden="true" />
            </div>
          </div>

          <div className={styles.dialogActionsStack}>
            <button
              type="submit"
              disabled={submitting || loadingOpts}
              className={clsx(styles.btn, styles.btnPrimary, styles.btnBlock)}
            >
              {submitting ? (
                <Loader2 size={22} className={styles.spin} aria-hidden="true" />
              ) : isEditing ? (
                'บันทึกข้อมูล (Save changes)'
              ) : (
                <>
                  ลงทะเบียนเพื่อเริ่มต้นใช้งาน
                  <ArrowRight size={20} aria-hidden="true" />
                </>
              )}
            </button>

            {canDismiss && (
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className={clsx(styles.btn, styles.btnSecondary, styles.btnBlock)}
              >
                ยกเลิก
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
