'use client';

import React, { useState } from 'react';
import { CheckCircle2, Copy, Info, Link as LinkIcon, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Select } from '@/components/ui';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { isResolvedOrClosedStatus } from '@/lib/tickets/detailState';
import type {
  TicketDetailLog,
  TicketDetailTicket,
  TicketDetailUser,
} from '@/types/tickets';
import styles from '@/app/(dashboard)/tickets/tickets-workspace.module.css';

interface TicketSidebarProps {
  ticket: TicketDetailTicket | null;
  user: TicketDetailUser | null;
  status: string;
  setStatus: (s: string) => void;
  priority: string;
  setPriority: (p: string) => void;
  selectedDept: string;
  setSelectedDept: (d: string) => void;
  availableDepts: { value: string; label: string }[];
  selectedModule: string;
  setSelectedModule: (m: string) => void;
  availableModules: string[];
  logs: TicketDetailLog[];
  showActivity?: boolean;
  showProfile?: boolean;
}

export function getTicketDuration(createdAt: string, resolvedAt?: string | null) {
  const start = new Date(createdAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const diff = end - start;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export const TicketSidebar: React.FC<TicketSidebarProps> = ({
  ticket,
  user,
  status,
  setStatus,
  priority,
  setPriority,
  selectedDept,
  setSelectedDept,
  availableDepts,
  selectedModule,
  setSelectedModule,
  availableModules,
  logs,
  showActivity = true,
  showProfile = true,
}) => {
  const { locale } = useStaffLocale();
  const [copied, setCopied] = useState(false);

  if (!ticket) return null;

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const magicLink = ticket.escalation_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/escalate/${ticket.escalation_token}`
    : null;

  const ticketStatus = ticket.status || '';
  const isResolvedOrClosed = isResolvedOrClosedStatus(ticketStatus);
  const isAdmin = user?.role === 'Administrator';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {showProfile && (
        <Card>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className={styles.summaryAvatar} aria-hidden="true">
                {ticket.customers?.avatar_url ? (
                  <Image
                    src={ticket.customers.avatar_url}
                    alt="avatar"
                    width={40}
                    height={40}
                    unoptimized
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <User size={18} />
                )}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700 }}>
                  {ticket.customers?.display_name || 'Customer'}
                </h4>
                <Badge size="sm" variant="primary">
                  CUSTOMER
                </Badge>
              </div>
            </div>
            <Link
              href={`/tickets?customerId=${ticket.customer_id}`}
              className={styles.iconLinkBtn}
              style={{ width: '100%', fontSize: 'var(--text-xs)', fontWeight: 600 }}
            >
              View customer ticket history
            </Link>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{locale === 'th' ? 'รายละเอียดใบงาน' : 'Issue Details'}</CardTitle>
        </CardHeader>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, lineHeight: 1.45 }}>
            {ticket.subject}
          </p>

          <Select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={isResolvedOrClosed && !isAdmin}
          >
            <option value="New">New</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Escalated">Escalated</option>
            <option value="Pending">Pending</option>
            <option value="Fix Completed">Fix Completed</option>
            <option value="Resolved">Resolved</option>
          </Select>

          <Select
            label="Priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </Select>

          <Select
            label={locale === 'th' ? 'มอบหมายแผนก' : 'Assign to Department'}
            value={selectedDept}
            onChange={(event) => setSelectedDept(event.target.value)}
            disabled={isResolvedOrClosed && !isAdmin}
          >
            {availableDepts.map((dept) => (
              <option key={dept.value} value={dept.value}>
                {dept.label}
              </option>
            ))}
          </Select>

          <Select
            label="Module"
            value={selectedModule}
            onChange={(event) => setSelectedModule(event.target.value)}
            disabled={isResolvedOrClosed && !isAdmin}
          >
            <option value="">-- Not specified --</option>
            {availableModules.map((moduleName) => (
              <option key={moduleName} value={moduleName}>
                {moduleName}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      {magicLink && !isResolvedOrClosed && (
        <Card style={{ borderStyle: 'dashed', borderColor: 'var(--color-primary)' }}>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
              <LinkIcon size={14} aria-hidden="true" />
              <span>MAGIC LINK (HANDOFF)</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                readOnly
                value={magicLink}
                aria-label="Handoff magic link"
                className={clsx(styles.searchInput, 'tabular-nums')}
                style={{ paddingLeft: '10px', height: '32px', fontSize: 'var(--text-xs)' }}
              />
              <Button
                size="sm"
                variant="primary"
                iconOnly
                onClick={() => handleCopyLink(magicLink)}
                aria-label={locale === 'th' ? 'คัดลอกลิงก์' : 'Copy link'}
              >
                {copied ? <CheckCircle2 size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              </Button>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              <Info size={13} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
              <span>
                แชร์ลิงก์นี้ให้ผู้รับช่วงงาน (External) เพื่อให้สามารถดูใบสรุปงานและบันทึกผลได้โดยไม่ต้องใช้รหัสผ่านพนักงาน
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {showActivity && (
        <Card>
          <CardHeader>
            <CardTitle>{locale === 'th' ? 'กิจกรรมล่าสุด' : 'Recent Activity'}</CardTitle>
          </CardHeader>
          <CardBody>
            {logs.length > 0 ? (
              <div className={styles.timelineList}>
                {logs.slice(0, 3).map((log, idx) => (
                  <div key={log.id || idx} className={styles.timelineItem}>
                    <div className={styles.timelineDot} aria-hidden="true" />
                    <p
                      className="tabular-nums"
                      style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-subtle)' }}
                    >
                      {new Date(log.created_at).toLocaleDateString()}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                      {log.action_type === 'status_change'
                        ? `Modified to ${log.to_status}`
                        : log.note || log.action_type}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                No logs recorded
              </p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
};
