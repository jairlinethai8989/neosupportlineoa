import { describe, expect, it } from 'vitest';
import {
  createStaffChatMediaUrl,
  normalizeChatMediaObjectPath,
} from './chatMediaPath';

const SUPABASE_URL = 'https://project.supabase.co';

describe('normalizeChatMediaObjectPath', () => {
  it.each([
    ['portal/ticket/file.webp', 'portal/ticket/file.webp'],
    [
      'https://project.supabase.co/storage/v1/object/public/chat_media/admin/file.webp',
      'admin/file.webp',
    ],
    [
      'https://project.supabase.co/storage/v1/object/sign/chat_media/folder/file.pdf?token=secret',
      'folder/file.pdf',
    ],
    [
      'https://project.supabase.co/storage/v1/object/sign/chat_media_private/folder/file.pdf?token=secret',
      'folder/file.pdf',
    ],
  ])('normalizes an owned chat media location', (value, expected) => {
    expect(normalizeChatMediaObjectPath(value, SUPABASE_URL)).toBe(expected);
  });

  it.each([
    '',
    '../secret',
    'folder/../../secret',
    '/absolute/file.png',
    'folder\\file.png',
    'https://evil.example/storage/v1/object/public/chat_media/file.png',
    'https://project.supabase.co.evil.example/storage/v1/object/public/chat_media/file.png',
    'http://project.supabase.co/storage/v1/object/public/chat_media/file.png',
  ])('rejects an untrusted media location: %s', (value) => {
    expect(normalizeChatMediaObjectPath(value, SUPABASE_URL)).toBeNull();
  });
});

describe('createStaffChatMediaUrl', () => {
  it('creates an authenticated application URL without exposing the storage URL', () => {
    expect(createStaffChatMediaUrl('folder/file.png', SUPABASE_URL)).toBe(
      '/api/media/chat?path=folder%2Ffile.png'
    );
  });

  it('leaves a non-storage external URL unchanged for legacy external content', () => {
    expect(createStaffChatMediaUrl('https://cdn.example/file.png', SUPABASE_URL)).toBe(
      'https://cdn.example/file.png'
    );
  });
});
