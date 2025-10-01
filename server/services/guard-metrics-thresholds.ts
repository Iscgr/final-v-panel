/**
 * Threshold configuration برای انواع تخلف.
 * مقادیر اولیه محافظه‌کارانه هستند و در آینده از settings یا DB لود می‌شوند.
 */
export interface MetricThreshold {
  warn: number;    // آستانه هشدار
  critical: number; // آستانه بحرانی
}

export const DEFAULT_GUARD_THRESHOLDS: Record<string, MetricThreshold> = {
  // نمونه‌ها - در آینده براساس نوع واقعی violation پر می‌شود
  'allocation_over_remaining': { warn: 2, critical: 5 },
  'allocation_negative_amount': { warn: 1, critical: 2 },
  'invariant_violation_I6': { warn: 3, critical: 6 },
  'invariant_violation_I7': { warn: 3, critical: 6 },
  // Placeholders for Outbox wiring (E-C1/E-C4)
  'outbox_failure_rate': { warn: 1, critical: 2 },        // percent
  'outbox_avg_retry': { warn: 1.5, critical: 2.5 },       // average retry count
  'outbox_latency_p95': { warn: 5000, critical: 8000 }    // ms
};

let dynamicThresholdCache: Record<string, MetricThreshold> | null = null;
let lastLoadTs = 0;
const CACHE_TTL_MS = 60_000; // 1m

/**
 * Placeholder loader: حال از threshold_config خوانده می‌شود.
 */
async function loadDynamicThresholds(): Promise<Record<string, MetricThreshold>> {
  const now = Date.now();
  if (dynamicThresholdCache && (now - lastLoadTs) < CACHE_TTL_MS) return dynamicThresholdCache;
  
  try {
    // Import dynamically to avoid circular dependency
    const { db } = await import('../db.js');
    const { thresholdConfig } = await import('../../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    const rows = await db.select({
      metricCode: thresholdConfig.metricCode,
      warnThreshold: thresholdConfig.warnThreshold,
      criticalThreshold: thresholdConfig.criticalThreshold
    }).from(thresholdConfig).where(eq(thresholdConfig.enabled, true));
    
    const dynamicMap: Record<string, MetricThreshold> = {};
    for (const row of rows) {
      dynamicMap[row.metricCode] = {
        warn: Number(row.warnThreshold),
        critical: Number(row.criticalThreshold)
      };
    }
    
    // Merge with defaults for any missing entries
    dynamicThresholdCache = { ...DEFAULT_GUARD_THRESHOLDS, ...dynamicMap };
    lastLoadTs = now;
    
    console.log('🎯 Dynamic thresholds loaded from DB:', Object.keys(dynamicMap));
    return dynamicThresholdCache;
  } catch (error) {
    console.warn('⚠️ Failed to load dynamic thresholds, using defaults:', error.message);
    dynamicThresholdCache = { ...DEFAULT_GUARD_THRESHOLDS };
    lastLoadTs = now;
    return dynamicThresholdCache;
  }
}

export async function getThresholdForAsync(type: string): Promise<MetricThreshold> {
  const map = await loadDynamicThresholds();
  return map[type] || { warn: 10, critical: 20 };
}

export function getThresholdFor(type: string): MetricThreshold {
  return DEFAULT_GUARD_THRESHOLDS[type] || { warn: 10, critical: 20 };
}
