type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const globalCache = globalThis as typeof globalThis & {
  __reportPreviewCache__?: Map<string, CacheEntry<unknown>>;
  __reportPreviewInflight__?: Map<string, Promise<unknown>>;
};

const cacheStore = globalCache.__reportPreviewCache__ ?? new Map<string, CacheEntry<unknown>>();
const inflightStore = globalCache.__reportPreviewInflight__ ?? new Map<string, Promise<unknown>>();

globalCache.__reportPreviewCache__ = cacheStore;
globalCache.__reportPreviewInflight__ = inflightStore;

export async function getOrSetPreviewCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const cached = cacheStore.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inflight = inflightStore.get(key) as Promise<T> | undefined;
  if (inflight) {
    return inflight;
  }

  const loadPromise = loader()
    .then((value) => {
      cacheStore.set(key, { value, expiresAt: now + ttlMs });
      return value;
    })
    .finally(() => {
      inflightStore.delete(key);
    });

  inflightStore.set(key, loadPromise);
  return loadPromise;
}

export function readPreviewCache<T>(key: string): T | null {
  const now = Date.now();
  const cached = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    cacheStore.delete(key);
    return null;
  }
  return cached.value;
}
