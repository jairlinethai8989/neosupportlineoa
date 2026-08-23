import { describe, expect, it } from 'vitest';
import {
  assertStaffAssetObjectInfo,
  parseStaffAssetReference,
  parseStaffAssetUpload,
} from './staffAssetSecurity';

describe('parseStaffAssetUpload', () => {
  it('accepts a bounded raster avatar with a matching extension', () => {
    expect(parseStaffAssetUpload('avatar', {
      mimeType: 'image/webp',
      extension: '.webp',
      size: 512_000,
    })).toEqual({ mimeType: 'image/webp', extension: 'webp', size: 512_000 });
  });
});

describe('assertStaffAssetObjectInfo', () => {
  it('rejects an uploaded object whose server metadata exceeds the limit or changes MIME type', () => {
    expect(() => assertStaffAssetObjectInfo(
      { size: 5 * 1024 * 1024 + 1, contentType: 'image/png' },
      'image/png'
    )).toThrow('Invalid uploaded staff asset');
    expect(() => assertStaffAssetObjectInfo(
      { size: 100, contentType: 'image/svg+xml' },
      'image/png'
    )).toThrow('Invalid uploaded staff asset');
  });
});

describe('parseStaffAssetReference', () => {
  it('accepts only the requested kind and authenticated staff-owned path', () => {
    const staffId = '11111111-1111-4111-8111-111111111111';
    const path = `staff-assets/signature/${staffId}/22222222-2222-4222-8222-222222222222.png`;

    expect(parseStaffAssetReference('signature', path, staffId)).toEqual({
      path,
      mimeType: 'image/png',
    });
    expect(() => parseStaffAssetReference(
      'avatar',
      path,
      staffId
    )).toThrow('Invalid staff asset path');
    expect(() => parseStaffAssetReference(
      'signature',
      path,
      '33333333-3333-4333-8333-333333333333'
    )).toThrow('Invalid staff asset path');
  });
});
