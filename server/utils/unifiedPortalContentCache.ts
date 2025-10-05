// In-memory cache for unified published portal content
type UnifiedPublishedPayload = {
  version: number;
  doc: any;
  cachedAt: number;
};

let publishedCache: UnifiedPublishedPayload | null = null;

export function getUnifiedPublishedCached(): UnifiedPublishedPayload | null {
  return publishedCache;
}

export function setUnifiedPublishedCache(doc: any, version: number) {
  publishedCache = { doc, version, cachedAt: Date.now() };
}

export function invalidateUnifiedPublishedCache() {
  publishedCache = null;
}
