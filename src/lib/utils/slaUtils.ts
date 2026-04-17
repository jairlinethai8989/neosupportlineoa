/* eslint-disable @typescript-eslint/no-explicit-any */

export type SlaSeverity = 'critical' | 'warning' | 'ok';

export interface BusinessHours {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
  days: number[]; // [1, 2, 3, 4, 5]
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  start: '08:30',
  end: '17:30',
  days: [1, 2, 3, 4, 5]
};

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

/**
 * Calculates a deadline by adding minutes while respecting business hours.
 */
export function calculateSlaDeadline(
  startDate: Date, 
  durationMinutes: number, 
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS
): Date {
  let remainingMins = durationMinutes;
  let currentDate = new Date(startDate);

  // Parse business hours
  const [startH, startM] = hours.start.split(':').map(Number);
  const [endH, endM] = hours.end.split(':').map(Number);

  while (remainingMins > 0) {
    // 1. If today is a weekend/non-working day, skip to next business day start
    if (!hours.days.includes(currentDate.getDay())) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(startH, startM, 0, 0);
      continue;
    }

    // 2. If current time is before business start, jump to start
    const businessStart = new Date(currentDate);
    businessStart.setHours(startH, startM, 0, 0);
    if (currentDate < businessStart) {
      currentDate = businessStart;
    }

    // 3. If current time is after business end, jump to next day start
    const businessEnd = new Date(currentDate);
    businessEnd.setHours(endH, endM, 0, 0);
    if (currentDate >= businessEnd) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(startH, startM, 0, 0);
      continue;
    }

    // 4. Calculate minutes remaining in the current business day
    const minsRemainingToday = Math.floor((businessEnd.getTime() - currentDate.getTime()) / 60000);

    if (remainingMins <= minsRemainingToday) {
      // We can finish today!
      currentDate.setMinutes(currentDate.getMinutes() + remainingMins);
      remainingMins = 0;
    } else {
      // Use up today and jump to tomorrow
      remainingMins -= minsRemainingToday;
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(startH, startM, 0, 0);
    }
  }

  return currentDate;
}
