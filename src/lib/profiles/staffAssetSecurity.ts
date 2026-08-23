export type StaffAssetKind = 'avatar' | 'signature' | 'company_logo';

const MAX_ASSET_SIZE = 5 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const UUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

export function parseStaffAssetKind(value: unknown): StaffAssetKind {
  const kind = String(value ?? '').trim();
  if (kind !== 'avatar' && kind !== 'signature' && kind !== 'company_logo') {
    throw new Error('Invalid staff asset');
  }
  return kind;
}

export function parseStaffAssetUpload(kind: StaffAssetKind, value: unknown) {
  parseStaffAssetKind(kind);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid staff asset');
  }

  const input = value as Record<string, unknown>;
  const mimeType = String(input.mimeType ?? '').trim().toLowerCase();
  const extension = String(input.extension ?? '').trim().toLowerCase().replace(/^\./, '');
  const size = Number(input.size);
  if (
    MIME_BY_EXTENSION[extension] !== mimeType ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > MAX_ASSET_SIZE
  ) {
    throw new Error('Invalid staff asset');
  }

  return { mimeType, extension, size };
}

export function parseStaffAssetReference(
  kind: StaffAssetKind,
  value: unknown,
  staffId: string
) {
  parseStaffAssetKind(kind);
  const path = String(value ?? '').trim();
  const escapedKind = kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedStaffId = staffId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `^staff-assets/${escapedKind}/${escapedStaffId}/${UUID_SOURCE}\\.(jpe?g|png|webp)$`,
    'i'
  );
  const match = path.match(pattern);
  const extension = match?.[1]?.toLowerCase();
  const mimeType = extension ? MIME_BY_EXTENSION[extension] : undefined;
  if (!mimeType) throw new Error('Invalid staff asset path');
  return { path, mimeType };
}

export function assertStaffAssetObjectInfo(
  value: { size?: unknown; contentType?: unknown },
  expectedMimeType: string
) {
  const size = Number(value.size);
  const contentType = String(value.contentType ?? '').trim().toLowerCase();
  if (
    !Number.isInteger(size) ||
    size < 1 ||
    size > MAX_ASSET_SIZE ||
    contentType !== expectedMimeType
  ) {
    throw new Error('Invalid uploaded staff asset');
  }
}
