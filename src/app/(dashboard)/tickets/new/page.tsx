'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Building,
  ChevronDown,
  File,
  Paperclip,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Badge, Button, Card, CardBody, PageHeader, Select, Textarea } from '@/components/ui';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { getStaffMessage, translateTicketPriority } from '@/lib/i18n/staff';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/utils/imageCompression';
import { calculateSlaDeadline } from '@/lib/utils/slaUtils';
import styles from '../tickets-workspace.module.css';

export default function CreateInternalTicketPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { projects, activeProject, ensureOrganizations, organizations: contextOrgs } = useAppContext();
  const { locale } = useStaffLocale();

  const orgBtnId = useId();
  const subjectBtnId = useId();

  // Form State
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [subjectTypes, setSubjectTypes] = useState<string[]>([]);

  // UI State
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [staffProfile, setStaffProfile] = useState<any>(null);

  const [isHospitalOpen, setIsHospitalOpen] = useState(false);
  const [isSubjectOpen, setIsSubjectOpen] = useState(false);
  const hospitalRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedProjectId && (activeProject?.id || projects[0]?.id)) {
      setSelectedProjectId(activeProject?.id || projects[0]?.id || '');
    }
  }, [activeProject?.id, projects, selectedProjectId]);

  useEffect(() => {
    void ensureOrganizations();
  }, [ensureOrganizations]);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setStaffProfile(p);
      }

      let orgQuery = supabase
        .from('organizations')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      let subjectQuery = supabase
        .from('ticket_subject_types')
        .select('name')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (selectedProjectId) {
        orgQuery = orgQuery.eq('project_id', selectedProjectId);
        subjectQuery = subjectQuery.or(`project_id.is.null,project_id.eq.${selectedProjectId}`);
      }

      const [{ data: hData }, { data: subjectsRes }] = await Promise.all([orgQuery, subjectQuery]);

      setOrganizations((hData && hData.length > 0 ? hData : contextOrgs) || []);
      const subjects = subjectsRes?.map((s: any) => s.name) || [];
      setSubjectTypes(
        subjects.length > 0 ? subjects : ['ลบ', 'แก้ไขออเดอร์', 'แจ้ง error', 'เรื่องอื่นๆ']
      );
    }
    void init();
  }, [contextOrgs, selectedProjectId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (hospitalRef.current && !hospitalRef.current.contains(event.target as Node)) {
        setIsHospitalOpen(false);
      }
      if (subjectRef.current && !subjectRef.current.contains(event.target as Node)) {
        setIsSubjectOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOrganizations = organizations.filter(
    (h) =>
      h.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.abbreviation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments = Array.from(files).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      }));
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospitalId) {
      setError(locale === 'th' ? 'กรุณาเลือกองค์กร/บริษัท' : 'Please select an organization');
      return;
    }
    if (!subject.trim()) {
      setError(locale === 'th' ? 'กรุณาระบุหัวข้อเรื่อง' : 'Please enter a subject');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];
      for (const att of attachments) {
        let fileToUpload = att.file;
        let contentType = att.file.type;
        let ext = att.file.name.split('.').pop();

        if (contentType.startsWith('image/')) {
          try {
            const compressed = await compressImage(att.file, { quality: 1.0 });
            fileToUpload = compressed;
            contentType = 'image/webp';
            ext = 'webp';
          } catch (err) {
            console.error('Ticket attachment compression failed:', err);
          }
        }

        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('chat_media')
          .upload(fileName, fileToUpload, { contentType });

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('chat_media').getPublicUrl(fileName);
          uploadedUrls.push(publicUrl);
        }
      }

      let staffCustomerId = null;
      if (staffProfile?.id) {
        const staffCustomerKey = `staff_${staffProfile.id}`;
        let existingCustQuery = supabase
          .from('customers')
          .select('id')
          .eq('line_user_id', staffCustomerKey);
        if (selectedProjectId) {
          existingCustQuery = existingCustQuery.eq('project_id', selectedProjectId);
        }
        const { data: existingCustomer } = await existingCustQuery.limit(1).maybeSingle();

        if (existingCustomer) {
          staffCustomerId = existingCustomer.id;
        } else {
          const customerInsert: Record<string, unknown> = {
            line_user_id: staffCustomerKey,
            display_name: `${staffProfile.full_name || 'Staff'} (Internal)`,
            full_name: staffProfile.full_name || 'Internal Staff',
            organization_id: selectedHospitalId,
          };
          if (selectedProjectId) {
            customerInsert.project_id = selectedProjectId;
          }
          const { data: newCustomer } = await supabase
            .from('customers')
            .insert([customerInsert])
            .select('id')
            .single();

          if (newCustomer) {
            staffCustomerId = newCustomer.id;
          }
        }
      }

      const selectedProj = projects.find((p) => p.id === selectedProjectId);
      const prefix = selectedProj?.code || 'TIC';
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const tempNo = `${prefix}-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;

      let slaDueAt = null;
      try {
        let slaQuery = supabase
          .from('sla_rules')
          .select('response_time_minutes, resolution_time_minutes, project_id')
          .eq('priority', priority);
        if (selectedProjectId) {
          slaQuery = slaQuery.or(`project_id.is.null,project_id.eq.${selectedProjectId}`);
        }
        const { data: slaRules } = await slaQuery;
        const slaRule =
          (slaRules || []).find((r: any) => r.project_id === selectedProjectId) ||
          (slaRules || [])[0] ||
          null;

        if (slaRule) {
          const duration = slaRule.resolution_time_minutes || slaRule.response_time_minutes || 60;
          slaDueAt = calculateSlaDeadline(new Date(), duration).toISOString();
        }
      } catch (e) {
        console.warn('SLA Calculation skipped:', e);
      }

      const ticketPayload: Record<string, unknown> = {
        ticket_no: tempNo,
        customer_id: staffCustomerId,
        organization_id: selectedHospitalId,
        subject: `[Private] ${subject}`,
        description: description || subject,
        status: 'New',
        priority: priority,
        assigned_agent_id: staffProfile?.id,
        source: 'Internal',
        sla_due_at: slaDueAt,
      };
      if (selectedProjectId) {
        ticketPayload.project_id = selectedProjectId;
      }

      const { data: newTicket, error: ticketError } = await supabase
        .from('tickets')
        .insert([ticketPayload])
        .select()
        .single();

      if (ticketError) throw new Error(`สร้างใบงานไม่สำเร็จ: ${ticketError.message}`);

      if (uploadedUrls.length > 0) {
        await supabase.from('ticket_logs').insert([
          {
            ticket_id: newTicket.id,
            action_type: 'create',
            performer_id: staffProfile?.id,
            note: `Internal Ticket created with ${uploadedUrls.length} attachments.\nURLs: ${uploadedUrls.join('\n')}`,
          },
        ]);

        for (const url of uploadedUrls) {
          await supabase.from('messages').insert([
            {
              ticket_id: newTicket.id,
              sender_type: 'system',
              content: url,
              message_type: 'image',
            },
          ]);
        }
      } else {
        await supabase.from('ticket_logs').insert([
          {
            ticket_id: newTicket.id,
            action_type: 'create',
            performer_id: staffProfile?.id,
            note: `Internal Ticket created by ${staffProfile?.full_name}`,
          },
        ]);
      }

      router.push(`/tickets/${newTicket.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const selectedHospital = organizations.find((h) => h.id === selectedHospitalId);

  const priorityClassMap: Record<string, string> = {
    Low: styles.priorityBtnActiveLow,
    Medium: styles.priorityBtnActiveMedium,
    High: styles.priorityBtnActiveHigh,
    Critical: styles.priorityBtnActiveCritical,
  };

  return (
    <div className={styles.createPage}>
      <PageHeader
        title={
          locale === 'th'
            ? 'สร้างใบงานใหม่ (สำหรับองค์กร/บริษัท)'
            : 'Create Internal Ticket'
        }
        subtitle={
          locale === 'th'
            ? 'สร้างใบงานระบุเจาะจงองค์กรหรือหน่วยงานภายในระบบ'
            : 'Create an organization-scoped internal support ticket'
        }
        actions={
          <Link
            href="/tickets"
            className={styles.iconLinkBtn}
            style={{ width: 'auto', padding: '0 12px', gap: '6px', fontSize: 'var(--text-xs)', fontWeight: 600 }}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            <span>{locale === 'th' ? 'กลับหน้ารายการ' : 'Back to tickets'}</span>
          </Link>
        }
      />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className={styles.createForm}>
            {error && (
              <div className={styles.debugBanner} role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {projects.length > 0 && (
              <Select
                label={locale === 'th' ? 'โครงการ' : 'Project'}
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setSelectedHospitalId('');
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} • {p.name}
                  </option>
                ))}
              </Select>
            )}

            {/* Organization Dropdown */}
            <div className={styles.dropdownWrap} ref={hospitalRef}>
              <label htmlFor={orgBtnId} className={styles.fieldLabel}>
                {locale === 'th' ? 'เลือกองค์กร/บริษัท' : 'Organization'}{' '}
                <span style={{ color: 'var(--color-danger)' }} aria-hidden="true">*</span>
              </label>
              <button
                id={orgBtnId}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isHospitalOpen}
                onClick={() => setIsHospitalOpen(!isHospitalOpen)}
                className={styles.dropdownTrigger}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <Building
                    size={16}
                    color={selectedHospital ? 'var(--color-primary)' : 'var(--color-text-muted)'}
                    aria-hidden="true"
                  />
                  <span
                    style={{
                      color: selectedHospital ? 'var(--color-text)' : 'var(--color-text-subtle)',
                      fontWeight: selectedHospital ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedHospital
                      ? selectedHospital.name
                      : locale === 'th'
                        ? 'ค้นหาหรือเลือกองค์กร/บริษัท...'
                        : 'Search or select organization...'}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    color: 'var(--color-text-muted)',
                    transform: isHospitalOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 150ms',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
              </button>

              {isHospitalOpen && (
                <div className={styles.dropdownPanel} role="listbox" aria-labelledby={orgBtnId}>
                  <div className={styles.dropdownSearchWrap}>
                    <Search
                      size={14}
                      style={{
                        position: 'absolute',
                        left: '18px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--color-text-subtle)',
                      }}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      placeholder={locale === 'th' ? 'พิมพ์เพื่อค้นหา...' : 'Type to search...'}
                      aria-label={locale === 'th' ? 'ค้นหาองค์กร/บริษัท' : 'Search organization'}
                      autoFocus
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={styles.searchInput}
                      style={{ height: '34px' }}
                    />
                  </div>
                  <div className={clsx(styles.dropdownList, 'custom-scrollbar')}>
                    {filteredOrganizations.length > 0 ? (
                      filteredOrganizations.map((h) => {
                        const isSelected = selectedHospitalId === h.id;
                        return (
                          <button
                            key={h.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setSelectedHospitalId(h.id);
                              setIsHospitalOpen(false);
                            }}
                            className={clsx(
                              styles.dropdownOption,
                              isSelected && styles.dropdownOptionSelected
                            )}
                          >
                            <span>{h.name}</span>
                            {h.abbreviation && (
                              <Badge size="sm" variant="neutral">
                                {h.abbreviation}
                              </Badge>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div
                        style={{
                          padding: '20px',
                          textAlign: 'center',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {locale === 'th' ? 'ไม่พบรายชื่อองค์กร/บริษัท' : 'No organizations found'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Subject Dropdown */}
            <div className={styles.dropdownWrap} ref={subjectRef}>
              <label htmlFor={subjectBtnId} className={styles.fieldLabel}>
                {locale === 'th' ? 'หัวข้อที่ต้องการแจ้ง' : 'Subject'}{' '}
                <span style={{ color: 'var(--color-danger)' }} aria-hidden="true">*</span>
              </label>
              <button
                id={subjectBtnId}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isSubjectOpen}
                onClick={() => setIsSubjectOpen(!isSubjectOpen)}
                className={styles.dropdownTrigger}
              >
                <span
                  style={{
                    color: subject ? 'var(--color-text)' : 'var(--color-text-subtle)',
                    fontWeight: subject ? 600 : 400,
                  }}
                >
                  {subject ||
                    (locale === 'th' ? 'เลือกหัวข้อเรื่องที่ต้องการแจ้ง...' : 'Select a subject...')}
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    color: 'var(--color-text-muted)',
                    transform: isSubjectOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 150ms',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
              </button>

              {isSubjectOpen && (
                <div className={styles.dropdownPanel} role="listbox" aria-labelledby={subjectBtnId}>
                  <div className={clsx(styles.dropdownList, 'custom-scrollbar')}>
                    {subjectTypes.map((st, idx) => (
                      <button
                        key={idx}
                        type="button"
                        role="option"
                        aria-selected={subject === st}
                        onClick={() => {
                          setSubject(st);
                          setIsSubjectOpen(false);
                        }}
                        className={clsx(
                          styles.dropdownOption,
                          subject === st && styles.dropdownOptionSelected
                        )}
                      >
                        {st}
                      </button>
                    ))}
                    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)' }}>
                      <input
                        type="text"
                        placeholder={locale === 'th' ? 'ระบุหัวข้ออื่นๆ...' : 'Custom subject...'}
                        aria-label={locale === 'th' ? 'ระบุหัวข้ออื่นๆ' : 'Custom subject'}
                        value={subjectTypes.includes(subject) ? '' : subject}
                        onChange={(e) => setSubject(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setIsSubjectOpen(false);
                          }
                        }}
                        className={styles.searchInput}
                        style={{ paddingLeft: '12px', height: '34px' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Textarea
              label={locale === 'th' ? 'รายละเอียดเพิ่มเติม' : 'Description'}
              rows={4}
              placeholder={locale === 'th' ? 'แจ้งรายละเอียดของปัญหา…' : 'Describe the issue...'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className={styles.dropdownWrap}>
              <span className={styles.fieldLabel}>
                {locale === 'th' ? 'แนบภาพหรือไฟล์' : 'Attachments'}
              </span>
              <div className={styles.attachmentsRow}>
                {attachments.map((att) => (
                  <div key={att.id} className={styles.attachmentThumb}>
                    {att.preview ? (
                      <img
                        src={att.preview}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        alt="Attachment preview"
                      />
                    ) : (
                      <File size={20} color="var(--color-text-muted)" aria-hidden="true" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      aria-label={locale === 'th' ? 'ลบไฟล์แนบ' : 'Remove attachment'}
                      className={styles.attachmentRemoveBtn}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.attachmentAddBtn}
                >
                  <Paperclip size={16} aria-hidden="true" />
                  <span>{locale === 'th' ? 'เพิ่มไฟล์' : 'Add file'}</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  style={{ display: 'none' }}
                  accept="image/*, application/pdf, .doc, .docx, .xls, .xlsx"
                />
              </div>
            </div>

            <div className={styles.dropdownWrap}>
              <span className={styles.fieldLabel}>
                {getStaffMessage(locale, 'dashboard.priorityBreakdown')}
              </span>
              <div className={styles.priorityGrid} role="radiogroup" aria-label="Ticket priority">
                {['Low', 'Medium', 'High', 'Critical'].map((p) => {
                  const active = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPriority(p)}
                      className={clsx(styles.priorityBtn, active && priorityClassMap[p])}
                    >
                      {translateTicketPriority(p, locale)}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              leftIcon={<ShieldCheck size={18} aria-hidden="true" />}
            >
              {locale === 'th' ? 'สร้างใบงาน' : 'Create Ticket'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
