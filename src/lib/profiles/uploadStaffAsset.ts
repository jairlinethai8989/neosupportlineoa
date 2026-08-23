import {
  createStaffAssetUploadAction,
  finalizeStaffAssetUploadAction,
} from '@/app/actions/staffAssetActions';
import { supabase } from '@/lib/supabase';
import type { StaffAssetKind } from './staffAssetSecurity';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function uploadStaffAsset(kind: StaffAssetKind, file: File) {
  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension) throw new Error('Invalid staff asset');

  const authorization = await createStaffAssetUploadAction(kind, {
    mimeType: file.type,
    extension,
    size: file.size,
  });
  const { error } = await supabase.storage
    .from('chat_media')
    .uploadToSignedUrl(authorization.path, authorization.token, file, {
      contentType: authorization.contentType,
    });
  if (error) throw new Error('Failed to upload staff asset');

  return finalizeStaffAssetUploadAction(kind, authorization.path);
}
