import { describe, expect, it } from 'vitest';
import {
  assertStaffAttachmentOwnership,
  getInternalAttachmentMediaInfo,
  parseInternalAttachmentUpload,
  parseInternalTicketInput,
} from './internalTicketSecurity';

const ATTACHMENT_PATH = 'staff/84000000-0000-0000-0000-000000000002/drafts/85000000-0000-0000-0000-000000000001.webp';

describe('parseInternalTicketInput', () => {
  it('accepts and normalizes a valid internal ticket request', () => {
    expect(parseInternalTicketInput({
      organizationId: '84000000-0000-0000-0000-000000000001',
      subject: '  Login problem  ',
      description: '  Cannot sign in  ',
      priority: 'High',
      attachmentPaths: [ATTACHMENT_PATH],
    })).toEqual({
      organizationId: '84000000-0000-0000-0000-000000000001',
      subject: 'Login problem',
      description: 'Cannot sign in',
      priority: 'High',
      attachmentPaths: [ATTACHMENT_PATH],
    });
  });

  it.each([
    { organizationId: 'bad', subject: 'Subject', description: '', priority: 'High', attachmentPaths: [] },
    { organizationId: '84000000-0000-0000-0000-000000000001', subject: '', description: '', priority: 'High', attachmentPaths: [] },
    { organizationId: '84000000-0000-0000-0000-000000000001', subject: 'Subject', description: '', priority: 'Urgent', attachmentPaths: [] },
    { organizationId: '84000000-0000-0000-0000-000000000001', subject: 'Subject', description: '', priority: 'High', attachmentPaths: ['other/file.png'] },
  ])('rejects invalid ticket input: %o', (value) => {
    expect(() => parseInternalTicketInput(value)).toThrow('Invalid internal ticket');
  });

  it('requires every attachment to belong to the authenticated staff prefix', () => {
    expect(() => assertStaffAttachmentOwnership([ATTACHMENT_PATH], '84000000-0000-0000-0000-000000000002')).not.toThrow();
    expect(() => assertStaffAttachmentOwnership([ATTACHMENT_PATH], '84000000-0000-0000-0000-000000000099')).toThrow('Invalid attachment path');
  });

  it('accepts only bounded attachment types and sizes', () => {
    expect(parseInternalAttachmentUpload({ mimeType: 'image/webp', extension: '.webp', size: 1024 })).toEqual({
      mimeType: 'image/webp', extension: 'webp', size: 1024,
    });
    expect(() => parseInternalAttachmentUpload({ mimeType: 'text/html', extension: 'html', size: 10 })).toThrow('Invalid attachment');
    expect(() => parseInternalAttachmentUpload({ mimeType: 'image/png', extension: 'jpg', size: 10 })).toThrow('Invalid attachment');
    expect(() => parseInternalAttachmentUpload({ mimeType: 'image/png', extension: 'png', size: 16 * 1024 * 1024 })).toThrow('Invalid attachment');
  });

  it('classifies image and document paths for safe message metadata', () => {
    expect(getInternalAttachmentMediaInfo(ATTACHMENT_PATH)).toEqual({
      mimeType: 'image/webp', messageType: 'image', content: '[IMAGE Attachment]',
    });
    expect(getInternalAttachmentMediaInfo(ATTACHMENT_PATH.replace('.webp', '.docx'))).toEqual({
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      messageType: 'file', content: '[FILE Attachment]',
    });
  });
});
