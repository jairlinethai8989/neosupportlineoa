const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITIES = new Set(['Critical', 'High', 'Medium', 'Low']);
const MEDIA_PATH_PATTERN = /^staff\/[0-9a-f-]{36}\/drafts\/[0-9a-f-]{36}\.(?:jpe?g|png|webp|gif|mp4|webm|mov|pdf|docx?|xlsx?)$/i;
const ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export type InternalTicketInput = {
  organizationId: string;
  subject: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  attachmentPaths: string[];
};

export function parseInternalTicketInput(value: unknown): InternalTicketInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid internal ticket');
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['organizationId', 'subject', 'description', 'priority', 'attachmentPaths'].includes(key))) {
    throw new Error('Invalid internal ticket');
  }

  const organizationId = String(input.organizationId ?? '').trim();
  const subject = String(input.subject ?? '').trim();
  const description = String(input.description ?? '').trim();
  const priority = String(input.priority ?? '');
  if (!UUID_PATTERN.test(organizationId) || subject.length < 1 || subject.length > 240 || description.length > 10_000 || !PRIORITIES.has(priority)) {
    throw new Error('Invalid internal ticket');
  }
  if (!Array.isArray(input.attachmentPaths) || input.attachmentPaths.length > 10) {
    throw new Error('Invalid internal ticket');
  }
  const attachmentPaths = input.attachmentPaths.map((path) => String(path).trim());
  if (new Set(attachmentPaths).size !== attachmentPaths.length || attachmentPaths.some((path) => !MEDIA_PATH_PATTERN.test(path))) {
    throw new Error('Invalid internal ticket');
  }

  return {
    organizationId,
    subject,
    description,
    priority: priority as InternalTicketInput['priority'],
    attachmentPaths,
  };
}

export function assertStaffAttachmentOwnership(paths: readonly string[], staffId: string) {
  const prefix = `staff/${staffId}/drafts/`;
  if (paths.some((path) => !path.startsWith(prefix))) throw new Error('Invalid attachment path');
}

export function parseInternalAttachmentUpload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid attachment');
  const input = value as Record<string, unknown>;
  const mimeType = String(input.mimeType ?? '').trim().toLowerCase();
  const extension = String(input.extension ?? '').trim().toLowerCase().replace(/^\./, '');
  const size = Number(input.size);
  if (ATTACHMENT_MIME_BY_EXTENSION[extension] !== mimeType || !Number.isInteger(size) || size < 1 || size > 15 * 1024 * 1024) {
    throw new Error('Invalid attachment');
  }
  return { mimeType, extension, size };
}

export function getInternalAttachmentMediaInfo(path: string) {
  const extension = path.split('.').pop()?.toLowerCase() || '';
  const mimeType = ATTACHMENT_MIME_BY_EXTENSION[extension];
  if (!mimeType) throw new Error('Invalid attachment path');
  return {
    mimeType,
    messageType: mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') ? 'video' : 'file',
    content: mimeType.startsWith('image/') ? '[IMAGE Attachment]' : mimeType.startsWith('video/') ? '[VIDEO Attachment]' : '[FILE Attachment]',
  } as const;
}
