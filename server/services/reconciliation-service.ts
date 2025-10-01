/**
 * ReconciliationService (Phase A - Iteration 2)
 * محاسبه drift بین مدل legacy تخصیص (is_allocated / مبلغ فاکتورهای paid) و ledger نو (payment_allocations)
 * حالت فعلی: فقط shadow محاسبه، درج رکورد در reconciliation_runs در صورت فعال بودن state مناسب.
 */
import { db } from '../database-manager';
import { payments, invoices, paymentAllocations, reconciliationRuns } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { featureFlagManager } from './feature-flag-manager.js';

export interface DriftMetrics {
  legacyAllocatedSum: number;   // مجموع مبلغ پرداخت‌های علامت‌خورده is_allocated یا فاکتورهای paid؟ (فعلاً پرداخت‌های allocated)
  ledgerAllocatedSum: number;   // Σ payment_allocations.allocated_amount
  diffAbs: number;              // قدر مطلق اختلاف
  diffRatio: number;            // diffAbs / max(legacyAllocatedSum, 1)
  status: 'OK' | 'WARN' | 'FAIL';
  thresholdWarn: number;
  thresholdFail: number;
}

export class ReconciliationService {
  /**
   * اجرای محاسبه drift در حالت shadow.
   * - در صورتی که active_reconciliation در حالت dry یا enforce باشد، درج رکورد.
   */
  static async runShadowDriftCheck(options?: { warn?: number; fail?: number; scope?: string; record?: boolean }): Promise<DriftMetrics> {
    const warnT = options?.warn ?? 0.0005;   // 0.05%
    const failT = options?.fail ?? 0.005;    // 0.5%
    const scope = options?.scope ?? 'global';

    // جمع legacy (مبالغ پرداخت‌هایی که is_allocated = true)
    const legacyRes = await db.execute(sql`SELECT COALESCE(SUM(CASE WHEN amount_dec IS NOT NULL THEN amount_dec ELSE NULLIF(regexp_replace(amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END),0) AS s FROM payments WHERE is_allocated = true`);
    const ledgerRes = await db.execute(sql`SELECT COALESCE(SUM(allocated_amount),0) AS s FROM payment_allocations`);

    const legacyAllocatedSum = Number((legacyRes as any).rows?.[0]?.s || 0);
    const ledgerAllocatedSum = Number((ledgerRes as any).rows?.[0]?.s || 0);

    const diffAbs = Math.abs(legacyAllocatedSum - ledgerAllocatedSum);
    const denom = Math.max(legacyAllocatedSum, 1);
    const diffRatio = diffAbs / denom;

    let status: DriftMetrics['status'] = 'OK';
    if (diffRatio >= failT) status = 'FAIL'; else if (diffRatio >= warnT) status = 'WARN';

    const metrics: DriftMetrics = {
      legacyAllocatedSum,
      ledgerAllocatedSum,
      diffAbs,
      diffRatio,
      status,
      thresholdWarn: warnT,
      thresholdFail: failT
    };

    if (metrics.status === 'FAIL') {
      console.error('[DRIFT][FAIL]', {
        diffAbs: metrics.diffAbs,
        diffRatio: metrics.diffRatio,
        legacyAllocatedSum: metrics.legacyAllocatedSum,
        ledgerAllocatedSum: metrics.ledgerAllocatedSum
      });
    } else if (metrics.status === 'WARN') {
      console.warn('[DRIFT][WARN]', {
        diffAbs: metrics.diffAbs,
        diffRatio: metrics.diffRatio
      });
    }

    // بررسی پرچم چندمرحله‌ای برای ثبت
    const reconState = featureFlagManager.getMultiStageFlagState('active_reconciliation');
    const canRecord = (reconState === 'dry' || reconState === 'enforce') && (options?.record ?? true);

    if (canRecord) {
      try {
        await db.insert(reconciliationRuns).values({
          scope,
          diffAbs: metrics.diffAbs,
          diffRatio: metrics.diffRatio,
          status: metrics.status,
          meta: { legacyAllocatedSum, ledgerAllocatedSum }
        });
      } catch (e: any) {
        console.error('Reconciliation record insert failed:', e.message);
      }
    }

    return metrics;
  }

  /**
   * Breakdown per representative (shadow) – برای تحلیل ریشه‌ای Drift.
   * خروجی: آرایه‌ای از { representativeId, legacyAllocatedSum, ledgerAllocatedSum, diffAbs, diffRatio }
   */
  static async runShadowDriftBreakdown(limit: number = 100): Promise<Array<{ representativeId: number; legacyAllocatedSum: number; ledgerAllocatedSum: number; diffAbs: number; diffRatio: number }>> {
    // Legacy: مجموع پرداخت‌های allocated گروه‌بندی شده
    const legacy = await db.execute(sql`SELECT representative_id AS rep_id, COALESCE(SUM(CASE WHEN amount_dec IS NOT NULL THEN amount_dec ELSE NULLIF(regexp_replace(amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END),0) AS s FROM payments WHERE is_allocated = true GROUP BY representative_id`);
    const ledger = await db.execute(sql`SELECT p.representative_id AS rep_id, COALESCE(SUM(pa.allocated_amount),0) AS s FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id GROUP BY p.representative_id`);

    const legacyMap = new Map<number, number>();
    (legacy as any).rows.forEach((r: any) => legacyMap.set(Number(r.rep_id), Number(r.s)));
    const ledgerMap = new Map<number, number>();
    (ledger as any).rows.forEach((r: any) => ledgerMap.set(Number(r.rep_id), Number(r.s)));

    const repIds = new Set<number>([...legacyMap.keys(), ...ledgerMap.keys()]);
    const rows: Array<{ representativeId: number; legacyAllocatedSum: number; ledgerAllocatedSum: number; diffAbs: number; diffRatio: number }> = [];
    for (const repId of repIds) {
      const leg = legacyMap.get(repId) ?? 0;
      const led = ledgerMap.get(repId) ?? 0;
      const diffAbs = Math.abs(leg - led);
      const diffRatio = diffAbs / Math.max(leg, 1);
      rows.push({ representativeId: repId, legacyAllocatedSum: leg, ledgerAllocatedSum: led, diffAbs, diffRatio });
    }
    // مرتب‌سازی بر اساس diffRatio نزولی برای تمرکز بر پرریسک‌ها
    rows.sort((a, b) => b.diffRatio - a.diffRatio);
    return rows.slice(0, limit);
  }
}
