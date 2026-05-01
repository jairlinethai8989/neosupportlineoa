import type { NotifType } from '@/types/notifications';
import type { InboxTicket } from '@/types/inbox';

export interface InboxToastInput {
  id: string;
  type: NotifType;
  title: string;
  body: string;
}

export function getInboxErrorMessage(error: unknown, fallback = 'Unknown error') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const message = typeof maybeError.message === 'string' ? maybeError.message : '';
    const details = typeof maybeError.details === 'string' ? maybeError.details : '';
    const hint = typeof maybeError.hint === 'string' ? maybeError.hint : '';
    const code = typeof maybeError.code === 'string' ? maybeError.code : '';
    const joined = [message, code ? `code=${code}` : '', details, hint].filter(Boolean).join(' | ');
    if (joined) return joined;
  }
  return fallback;
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

export function getInboxErrorToast(title: string, error: unknown): InboxToastInput {
  return {
    id: `inbox-error-${title.toLowerCase().replace(/\s+/g, '-')}`,
    type: 'message',
    title,
    body: getInboxErrorMessage(error),
  };
}

export function getInboxWarningToast(title: string, body: string): InboxToastInput {
  return {
    id: `inbox-warning-${title.toLowerCase().replace(/\s+/g, '-')}`,
    type: 'message',
    title,
    body,
  };
}
