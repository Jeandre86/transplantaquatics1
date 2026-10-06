type CacheEntry = { expiresAt: number; promise: Promise<unknown> };

const requestCache = new Map<string, CacheEntry>();

/** Share short-lived read requests between pages during a browsing session. */
export function loadCached<T>(key: string, loader: () => Promise<T>, ttlMs = 20_000): Promise<T> {
  const current = requestCache.get(key);
  if (current && current.expiresAt > Date.now()) return current.promise as Promise<T>;

  const entry: CacheEntry = { expiresAt: Number.POSITIVE_INFINITY, promise: Promise.resolve().then(loader) };
  requestCache.set(key, entry);
  entry.promise = entry.promise.then(value => {
    entry.expiresAt = Date.now() + ttlMs;
    return value;
  }).catch(error => {
    if (requestCache.get(key) === entry) requestCache.delete(key);
    throw error;
  });
  return entry.promise as Promise<T>;
}

export function clearCachedRequest(key?: string): void {
  if (key) requestCache.delete(key);
  else requestCache.clear();
}
