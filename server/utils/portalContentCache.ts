/**
 * Simple in-memory cache for portal content (Phase 4 - Todo 7)
 * قابل تعویض با Redis در آینده.
 */

type CacheEntry<T> = { value: T; expiresAt: number };
const map = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL_MS = 30_000; // 30 ثانیه
const now = () => Date.now();

export function getCache<T>(key: string): T | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (entry.expiresAt < now()) { map.delete(key); return null; }
  return entry.value as T;
}
export function setCache<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS) {
  map.set(key, { value, expiresAt: now() + ttlMs });
}
export function invalidate(keys: string | string[]) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const k of list) map.delete(k);
}
export const PortalContentCacheKeys = { FULL: 'portalContent:full', STATUS: 'portalContent:status' } as const;
export function invalidateAllPortalContent() { invalidate([PortalContentCacheKeys.FULL, PortalContentCacheKeys.STATUS]); }
export function getCachedFull<T = any>() { return getCache<T>(PortalContentCacheKeys.FULL); }
export function cacheFull(payload: any) { setCache(PortalContentCacheKeys.FULL, payload); }
export function getCachedStatus<T = any>() { return getCache<T>(PortalContentCacheKeys.STATUS); }
export function cacheStatus(payload: any) { setCache(PortalContentCacheKeys.STATUS, payload); }
export function _dumpPortalCacheKeys() { return Array.from(map.keys()); }
