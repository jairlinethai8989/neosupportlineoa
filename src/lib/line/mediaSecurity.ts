export function assertImportableLineMediaProvider(provider: unknown): asserts provider is 'line' | undefined {
  if (provider === 'external') {
    throw new TypeError('External LINE media import is disabled');
  }
  if (provider !== undefined && provider !== 'line') {
    throw new TypeError('Unsupported LINE media provider');
  }
}

type DestroyableMediaStream = AsyncIterable<Uint8Array | string> & {
  destroy?: () => void;
};

export async function readLineMediaWithLimit(
  stream: DestroyableMediaStream,
  maxBytes = 15 * 1024 * 1024
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('Invalid LINE media size limit');
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      stream.destroy?.();
      throw new RangeError('LINE media is too large');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, totalBytes);
}
