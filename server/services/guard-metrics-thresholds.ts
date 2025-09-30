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
 * Placeholder loader: in آینده threshold_config خوانده می‌شود.
 * فعلاً فقط DEFAULT را بازمی‌گرداند.
 */
async function loadDynamicThresholds(): Promise<Record<string, MetricThreshold>> {
  const now = Date.now();
  if (dynamicThresholdCache && (now - lastLoadTs) < CACHE_TTL_MS) return dynamicThresholdCache;
  // TODO: SELECT metric_code, warn_threshold, critical_threshold FROM threshold_config WHERE enabled=true
  dynamicThresholdCache = { ...DEFAULT_GUARD_THRESHOLDS };
  lastLoadTs = now;
  return dynamicThresholdCache;
}

export async function getThresholdForAsync(type: string): Promise<MetricThreshold> {
  const map = await loadDynamicThresholds();
  return map[type] || { warn: 10, critical: 20 };
}

export function getThresholdFor(type: string): MetricThreshold {
  return DEFAULT_GUARD_THRESHOLDS[type] || { warn: 10, critical: 20 };
}
