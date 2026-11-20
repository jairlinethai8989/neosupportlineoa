import React from 'react';
import { ArrowLeft, Bot, CheckCircle, FileDown, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Badge, Button } from '@/components/ui';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import {
  canResolveTicket,
  isResolvedOrClosedStatus,
  isTicketOwnerOrAdmin,
} from '@/lib/tickets/detailState';
import type { TicketDetailTicket, TicketDetailUser } from '@/types/tickets';
import styles from '@/app/(dashboard)/tickets/tickets-workspace.module.css';

interface TicketHeaderProps {
  ticket: TicketDetailTicket | null;
  status: string;
  user: TicketDetailUser | null;
  updating: boolean;
  isChatActive: boolean;
  onUpdate: () => void;
  onResolveClick: () => void;
  onRejectFixCompleted: () => void;
  onExportClick: () => void;
  onAiSummaryClick?: () => void;
  aiLoading?: boolean;
}

export const TicketHeader: React.FC<TicketHeaderProps> = ({
  ticket,
  status,
  user,
  updating,
  isChatActive,
  onUpdate,
  onResolveClick,
  onRejectFixCompleted,
  onExportClick,
  onAiSummaryClick,
  aiLoading = false,
}) => {
  const router = useRouter();
  const { locale } = useStaffLocale();

  if (!ticket) return null;

  const isResolvedOrClosed = isResolvedOrClosedStatus(status);
  const isOwnerOrAdmin = isTicketOwnerOrAdmin(ticket, user);
  const canResolve = canResolveTicket(status, isOwnerOrAdmin, isChatActive);
  const canReviewFixCompleted = status === 'Fix Completed';

  const statusLower = status.toLowerCase();
  const statusVariant =
    statusLower === 'resolved' || statusLower === 'closed'
      ? 'success'
      : statusLower === 'pending'
        ? 'danger'
        : statusLower === 'in progress' || statusLower === 'escalated'
          ? 'warning'
          : 'primary';

  return (
    <header className={styles.detailHeader}>
      <div className={styles.detailHeaderLeft}>
        <Button
          size="md"
          variant="secondary"
          iconOnly
          onClick={() => router.push('/tickets')}
          aria-label={locale === 'th' ? 'กลับหน้ารายการใบงาน' : 'Back to tickets'}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Button>

        <div>
          <div className={styles.detailTitleRow}>
            <h1 className={clsx(styles.detailTitle, 'tabular-nums')}>#{ticket.ticket_no}</h1>
            <Badge size="md" variant={statusVariant} dot>
              {status}
            </Badge>
            {ticket.assigned_agent && (
              <Badge size="md" variant="primary">
                {ticket.assigned_agent.display_name}
              </Badge>
            )}
          </div>
          <p className={styles.detailMetaLine}>
            <span>{locale === 'th' ? 'รายละเอียดและการจัดการใบงาน' : 'Ticket Details & Management'}</span>
            {ticket.created_at && (
              <>
                <span aria-hidden="true">•</span>
                <span className="tabular-nums">
                  {locale === 'th' ? 'แจ้งเมื่อ' : 'Reported'}:{' '}
                  {new Date(ticket.created_at).toLocaleString('th-TH', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className={styles.detailActions}>
        {isResolvedOrClosed && onAiSummaryClick && (
          <Button
            size="md"
            variant="secondary"
            loading={aiLoading}
            onClick={onAiSummaryClick}
            leftIcon={<Bot size={16} aria-hidden="true" />}
          >
            {ticket.ai_analysis ? 'สรุปเคสด้วย AI อีกครั้ง' : 'สรุปเคสด้วย AI'}
          </Button>
        )}

        <Button
          size="md"
          variant="secondary"
          onClick={onExportClick}
          leftIcon={<FileDown size={16} aria-hidden="true" />}
        >
          Ticket Summary
        </Button>

        {canReviewFixCompleted && (
          <>
            <Button size="md" variant="warning" onClick={onRejectFixCompleted}>
              ส่งกลับแก้ต่อ
            </Button>
            <Button
              size="md"
              variant="primary"
              onClick={onResolveClick}
              leftIcon={<CheckCircle size={16} aria-hidden="true" />}
            >
              ยืนยันผลและปิดงาน
            </Button>
          </>
        )}

        {!canReviewFixCompleted && canResolve && (
          <Button
            size="md"
            variant="primary"
            onClick={onResolveClick}
            leftIcon={<CheckCircle size={16} aria-hidden="true" />}
          >
            Resolve Ticket
          </Button>
        )}

        <Button
          size="md"
          variant="primary"
          loading={updating}
          onClick={onUpdate}
          leftIcon={<Save size={16} aria-hidden="true" />}
        >
          {locale === 'th' ? 'รีเฟรช / บันทึก' : 'Save Changes'}
        </Button>
      </div>
    </header>
  );
};
