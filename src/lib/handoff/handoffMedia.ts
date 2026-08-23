import { randomUUID } from 'node:crypto';

const SAFE_SEGMENT = /^[a-zA-Z0-9-]+$/;
const SAFE_EXTENSION = /^[a-z0-9]+$/;

export function createHandoffMediaPath(
  handoffId: string,
  extension: string,
  id: string = randomUUID()
) {
  if (!SAFE_SEGMENT.test(handoffId) || !SAFE_SEGMENT.test(id) || !SAFE_EXTENSION.test(extension)) {
    throw new Error('Invalid handoff attachment path');
  }

  return `handoff/${handoffId}/${id}.${extension}`;
}

export function isOwnedHandoffMediaPath(handoffId: string, path: string) {
  if (!SAFE_SEGMENT.test(handoffId) || path.includes('..')) return false;
  return new RegExp(`^handoff/${handoffId}/[a-zA-Z0-9-]+\\.[a-z0-9]+$`).test(path);
}
