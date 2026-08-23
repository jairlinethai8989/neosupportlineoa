export function parseInboxAttachmentReference(value: unknown, staffId: string, conversationId: string) {
  const path = String(value ?? '').trim();
  const escape = (part: string) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `^staff/${escape(staffId)}/conversations/${escape(conversationId)}/[0-9a-f-]{36}\\.(?:jpe?g|png|webp|gif|mp4|webm|mov|pdf|docx?|xlsx?)$`,
    'i'
  );
  if (!pattern.test(path)) throw new Error('Invalid inbox attachment');
  return path;
}
