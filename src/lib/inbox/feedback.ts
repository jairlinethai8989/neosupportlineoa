import type { NotifType } from '@/types/notifications';
import type { InboxTicket } from '@/types/inbox';

export interface InboxToastInput {
  id: string;
  type: NotifType;
  title: string;
  body: string;
}

export function getInboxErrorMessage(error: unknown, fallback = 'Unknown error') {
  return error instanceof Error ? error.message : fallback;
}

export function getInboxClosedTicketMessage() {
  return 'ใบงานนี้ถูกปิดแล้ว ไม่สามารถส่งข้อความได้';
}

export function getInboxDeleteFailedMessage(error?: string) {
  return error || 'Delete failed';
}

export function getInboxUploadFailedMessage(error: unknown) {
  return `Upload Failed: ${getInboxErrorMessage(error)}`;
}

export function getInboxActionFailedMessage(prefix: string, error: unknown) {
  return `${prefix}: ${getInboxErrorMessage(error)}`;
}

export function getInboxClaimSuccessToast(ticket: InboxTicket | null): InboxToastInput {
  return {
    id: 'claim-success',
    type: 'ticket',
    title: 'รับงานสำเร็จ',
    body: `คุณได้รับใบงาน #${ticket?.ticket_no || ''} แล้ว`,
  };
}

export function getInboxResolveSuccessToast(): InboxToastInput {
  return {
    id: 'resolve-success',
    type: 'ticket',
    title: 'ปิดงานสำเร็จ',
    body: 'ใบงานได้รับการสรุปผลและแจ้งลูกค้าเรียบร้อยแล้ว',
  };
}

export function getInboxCloseSuccessToast(): InboxToastInput {
  return {
    id: 'close-success',
    type: 'ticket',
    title: 'จบการสนทนาแล้ว',
    body: 'คุณสามารถปิดงานต่อได้จากแถบด้านขวา',
  };
}
