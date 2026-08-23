import { randomUUID } from 'node:crypto';

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ALLOWED_MEDIA = new Map([
  ['image/jpeg', { extension: 'jpg', messageType: 'image' as const }],
  ['image/png', { extension: 'png', messageType: 'image' as const }],
  ['image/webp', { extension: 'webp', messageType: 'image' as const }],
  ['image/gif', { extension: 'gif', messageType: 'image' as const }],
  ['application/pdf', { extension: 'pdf', messageType: 'file' as const }],
  ['text/plain', { extension: 'txt', messageType: 'file' as const }],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', { extension: 'docx', messageType: 'file' as const }],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', { extension: 'xlsx', messageType: 'file' as const }],
]);

export interface PortalMediaInput {
  name: string;
  type: string;
  size: number;
}

export function parsePortalMediaInput(input: PortalMediaInput) {
  if (!Number.isSafeInteger(input.size) || input.size <= 0) {
    throw new Error('Attachment size is invalid');
  }
  if (input.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('Attachment is too large');
  }

  const media = ALLOWED_MEDIA.get(input.type.toLowerCase());
  if (!media) {
    throw new Error('Unsupported attachment type');
  }

  return { ...media, contentType: input.type.toLowerCase(), size: input.size };
}

export function createPortalMediaPath(ticketId: string, extension: string, id: string = randomUUID()) {
  if (!/^[a-zA-Z0-9-]+$/.test(ticketId) || !/^[a-z0-9]+$/.test(extension)) {
    throw new Error('Invalid attachment path');
  }
  return `portal/${ticketId}/${id}.${extension}`;
}

export function isOwnedPortalMediaPath(ticketId: string, path: string) {
  return path.startsWith(`portal/${ticketId}/`) && !path.includes('..');
}
