'use server';

import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import {
  assertStaffAssetObjectInfo,
  parseStaffAssetKind,
  parseStaffAssetReference,
  parseStaffAssetUpload,
  type StaffAssetKind,
} from '@/lib/profiles/staffAssetSecurity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const PUBLIC_ASSET_BUCKET = 'chat_media';

async function requireStaffAssetAccess(kind: StaffAssetKind) {
  return kind === 'company_logo'
    ? requireStaffAuth({ permission: 'settings_branding', level: 'edit' })
    : requireStaffAuth();
}

export async function createStaffAssetUploadAction(kindValue: unknown, value: unknown) {
  const kind = parseStaffAssetKind(kindValue);
  const { user } = await requireStaffAssetAccess(kind);
  const input = parseStaffAssetUpload(kind, value);
  const path = `staff-assets/${kind}/${user.id}/${crypto.randomUUID()}.${input.extension}`;
  const { data, error } = await supabaseAdmin.storage
    .from(PUBLIC_ASSET_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data?.token) throw new Error('Failed to authorize staff asset upload');
  return { path, token: data.token, contentType: input.mimeType };
}

export async function finalizeStaffAssetUploadAction(kindValue: unknown, pathValue: unknown) {
  const kind = parseStaffAssetKind(kindValue);
  const staff = await requireStaffAssetAccess(kind);
  const reference = parseStaffAssetReference(kind, pathValue, staff.user.id);
  const storage = supabaseAdmin.storage.from(PUBLIC_ASSET_BUCKET);
  const { data: objectInfo, error: infoError } = await storage.info(reference.path);

  if (infoError || !objectInfo) throw new Error('Staff asset upload is incomplete');
  try {
    assertStaffAssetObjectInfo(objectInfo, reference.mimeType);
  } catch {
    await storage.remove([reference.path]);
    throw new Error('Invalid uploaded staff asset');
  }

  const { data: publicData } = storage.getPublicUrl(reference.path);
  const publicUrl = publicData.publicUrl;
  const updatedAt = new Date().toISOString();
  let mutationError: { message?: string } | null = null;
  let entityType = 'PROFILE';
  let entityId = staff.user.id;

  if (kind === 'company_logo') {
    entityType = 'COMPANY';
    const { data: row, error: readError } = await supabaseAdmin
      .from('company_settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (readError || !row?.id) {
      await storage.remove([reference.path]);
      throw new Error('Company settings are not configured');
    }
    entityId = String(row.id);
    const result = await supabaseAdmin
      .from('company_settings')
      .update({ logo_url: publicUrl, updated_at: updatedAt })
      .eq('id', row.id);
    mutationError = result.error;
  } else {
    const field = kind === 'avatar' ? 'avatar_url' : 'signature_url';
    const result = await supabaseAdmin
      .from('profiles')
      .update({ [field]: publicUrl, updated_at: updatedAt })
      .eq('id', staff.user.id);
    mutationError = result.error;
  }

  if (mutationError) {
    await storage.remove([reference.path]);
    throw new Error('Failed to save staff asset');
  }

  await supabaseAdmin.from('system_logs').insert([{
    performer_id: staff.user.id,
    action_type: kind === 'company_logo'
      ? 'BRANDING_LOGO_UPDATE'
      : kind === 'avatar'
        ? 'PROFILE_AVATAR_UPDATE'
        : 'PROFILE_SIGNATURE_UPDATE',
    entity_type: entityType,
    entity_id: entityId,
    new_data: { asset_kind: kind },
    note: `Updated ${kind.replace('_', ' ')}`,
    created_at: updatedAt,
  }]);

  return { publicUrl };
}
