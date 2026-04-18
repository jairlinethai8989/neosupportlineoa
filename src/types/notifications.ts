export type NotifType = 'sla' | 'sla_warning' | 'ticket' | 'message';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  ticketNo?: string | number;
  ticketId?: string;
  createdAt: string;
  isRead: boolean;
  minutesRemaining?: number;
}

export interface ToastNotif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  ticketNo?: string | number;
  ticketId?: string;
  conversationId?: string;
  duration?: number;
}
