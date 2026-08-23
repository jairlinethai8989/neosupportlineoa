import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

type HandoffAccessInput = {
  suppliedPin: string;
  storedPin: string;
  status: string;
  expiresAt: string;
  now?: Date;
};

export type HandoffAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: 'invalid-pin' | 'expired' };

export function parseHandoffToken(value: string) {
  const token = value.trim();
  if (token.length < 8 || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('Invalid handoff token');
  }
  return token;
}

export function generateSecurePin(generate: (max: number) => number = randomInt) {
  return String(1000 + generate(9000));
}

export function requireHandoffAccessPepper(value = process.env.HANDOFF_ACCESS_PEPPER) {
  if (!value || value.length < 32) {
    throw new Error('HANDOFF_ACCESS_PEPPER must contain at least 32 characters');
  }
  return value;
}

export function hashHandoffCredential(kind: 'token' | 'pin', value: string, pepper = requireHandoffAccessPepper()) {
  return createHmac('sha256', pepper).update(`neosupport-handoff:${kind}\0${value}`, 'utf8').digest('hex');
}

function pinsMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function authorizeHandoffAccess(input: HandoffAccessInput): HandoffAccessDecision {
  if (!pinsMatch(input.suppliedPin, input.storedPin)) {
    return { allowed: false, reason: 'invalid-pin' };
  }

  const expiresAt = new Date(input.expiresAt);
  const now = input.now || new Date();
  if (input.status === 'Expired' || !Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    return { allowed: false, reason: 'expired' };
  }

  return { allowed: true };
}
