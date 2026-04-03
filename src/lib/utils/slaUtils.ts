/* eslint-disable @typescript-eslint/no-explicit-any */

export type SlaSeverity = 'critical' | 'warning' | 'ok';

/**
 * Returns whether a ticket has breached its SLA deadline.
 */
export function isSlaBreached(ticket: any): boolean {
  if (!ticket.sla_due_at) return false;
  if (['Resolved', 'Closed'].includes(ticket.status)) return false;
  return new Date(ticket.sla_due_at) < new Date();
}

/**
 * Returns minutes remaining until SLA breach (negative if already breached).
 */
export function slaMinutesRemaining(ticket: any): number {
  if (!ticket.sla_due_at) return Infinity;
  const due = new Date(ticket.sla_due_at).getTime();
  const now = Date.now();
  return Math.floor((due - now) / 60000);
}

/**
 * Returns a severity level based on SLA time remaining.
 */
export function getSlaSeverity(ticket: any): SlaSeverity {
  const mins = slaMinutesRemaining(ticket);
  if (mins < 0) return 'critical';
  if (mins < 30) return 'warning';
  return 'ok';
}

/**
 * Formats a human-readable SLA status label (Thai).
 */
export function formatSlaStatus(ticket: any): string {
  const mins = slaMinutesRemaining(ticket);
  if (mins === Infinity) return 'ไม่มี SLA';
  if (mins < 0) return `เกิน SLA ${Math.abs(mins)} นาที`;
  if (mins < 60) return `เหลือ ${mins} นาที`;
  const hrs = Math.floor(mins / 60);
  return `เหลือ ${hrs} ชั่วโมง`;
}
