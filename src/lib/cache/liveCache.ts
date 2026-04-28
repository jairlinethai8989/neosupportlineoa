type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const globalCache = globalThis as typeof globalThis & {
  __liveCache__?: Map<string, CacheEntry<unknown>>;
  __liveInflight__?: Map<string, Promise<unknown>>;
  __liveVersion__?: number;
};

const cacheStore = globalCache.__liveCache__ ?? new Map<string, CacheEntry<unknown>>();
const inflightStore = globalCache.__liveInflight__ ?? new Map<string, Promise<unknown>>();
const cacheVersion = globalCache.__liveVersion__ ?? 1;

globalCache.__liveCache__ = cacheStore;
globalCache.__liveInflight__ = inflightStore;
globalCache.__liveVersion__ = cacheVersion;

export function buildVersionedLiveCacheKey(baseKey: string): string {
  return `v${globalCache.__liveVersion__ || 1}:${baseKey}`;
}

export function readLiveCache<T>(key: string): T | null {
  const now = Date.now();
  const cached = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    cacheStore.delete(key);
    return null;
  }
  return cached.value;
}

export async function getOrSetLiveCache<T>(
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
      cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflightStore.delete(key);
    });

  inflightStore.set(key, loadPromise);
  return loadPromise;
}

export function invalidateAllLiveCaches() {
  cacheStore.clear();
  inflightStore.clear();
  globalCache.__liveVersion__ = (globalCache.__liveVersion__ || 1) + 1;
}

