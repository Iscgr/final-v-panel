/**
 * BackfillService (Phase A - Iteration 3)
 * حالت dry-run برای تولید خطوط synthetic در آینده.
 * اکنون: فقط محاسبه اختلاف برای پرداخت‌های allocated که ledger row ندارند.
 */
import { db } from '../database-manager.js';
import { payments, paymentAllocations } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { featureFlagManager } from './feature-flag-manager.js';
import { InvoiceBalanceCacheService } from './invoice-balance-cache-service.js';

export interface BackfillDryRunResult {
  candidateCount: number;
  sample: Array<{ paymentId: number; amount: number }>;
  state: string;
}

export class BackfillService {
  /**
   * Dry-run: شناسایی پرداخت‌های allocated بدون رکورد ledger.
   * ledger_backfill_mode باید read_only باشد.
   */
  static async dryRun(limit: number = 50): Promise<BackfillDryRunResult> {
    const backfillState = featureFlagManager.getMultiStageFlagState('ledger_backfill_mode');
    if (backfillState !== 'read_only') {
      throw new Error(`ledger_backfill_mode باید read_only باشد (state=${backfillState})`);
    }

    // انتخاب پرداخت‌هایی که is_allocated=true و در payment_allocations وجود ندارند
    const result = await db.execute(sql`
      SELECT p.id AS payment_id,
             COALESCE(CASE WHEN p.amount_dec IS NOT NULL THEN p.amount_dec ELSE NULLIF(regexp_replace(p.amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END,0) AS amount
      FROM payments p
      LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
      WHERE p.is_allocated = true AND pa.id IS NULL
      LIMIT ${limit};
    `);

    const rows = (result as any).rows || [];

    // شمار کل کاندیدها
    const countRes = await db.execute(sql`
      SELECT COUNT(*) AS c FROM payments p
      LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
      WHERE p.is_allocated = true AND pa.id IS NULL;
    `);
    const candidateCount = Number((countRes as any).rows?.[0]?.c || 0);

    return {
      candidateCount,
      sample: rows.map((r: any) => ({ paymentId: Number(r.payment_id), amount: Number(r.amount) })),
      state: backfillState
    };
  }

  /**
   * Active backfill: درج خطوط synthetic برای پرداخت‌های allocated که هنوز ledger entry ندارند.
   * پیش‌نیاز: ledger_backfill_mode = active و allocation_dual_write در حالت shadow یا enforce.
   * سیاست ساده: هر پرداخت کامل به یک خط allocation (full amount) اگر invoiceId ست باشد؛ در غیر این صورت رد.
   * (مرحله بعدی برای partial/بدون invoice نیاز الگوریتم توزیع دارد.)
   */
  static async active(batchSize: number = 200): Promise<{ inserted: number; skipped: number; state: string }> {
    const backfillState = featureFlagManager.getMultiStageFlagState('ledger_backfill_mode');
    if (backfillState !== 'active') {
      throw new Error(`ledger_backfill_mode باید active باشد (state=${backfillState})`);
    }
    const dualState = featureFlagManager.getMultiStageFlagState('allocation_dual_write');
    if (dualState === 'off') {
      throw new Error(`allocation_dual_write باید حداقل shadow باشد (state=${dualState})`);
    }

    // انتخاب batch پرداخت‌های allocated بدون رکورد ledger با invoiceId معتبر
    const candidates = await db.execute(sql`
      SELECT p.id AS payment_id,
             p.invoice_id AS invoice_id,
             COALESCE(CASE WHEN p.amount_dec IS NOT NULL THEN p.amount_dec ELSE NULLIF(regexp_replace(p.amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END,0) AS amount
      FROM payments p
      LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
      WHERE p.is_allocated = true
        AND pa.id IS NULL
        AND p.invoice_id IS NOT NULL
      LIMIT ${batchSize};
    `);

    const rows = (candidates as any).rows || [];
    if (!rows.length) {
      return { inserted: 0, skipped: 0, state: backfillState };
    }

  let inserted = 0; let skipped = 0; const touchedInvoices = new Set<number>();
    for (const r of rows) {
      try {
        await db.insert(paymentAllocations).values({
          paymentId: Number(r.payment_id),
          invoiceId: Number(r.invoice_id),
          allocatedAmount: Number(r.amount),
          method: 'backfill',
          synthetic: true,
          idempotencyKey: `bf:p:${r.payment_id}:i:${r.invoice_id}`
        });
        inserted++;
        touchedInvoices.add(Number(r.invoice_id));
      } catch (e: any) {
        skipped++;
      }
    }
    // Cache sync batch
    for (const invId of touchedInvoices) {
      try { await InvoiceBalanceCacheService.recompute(invId); } catch {}
    }
    return { inserted, skipped, state: backfillState };
  }

  /**
   * distributePartialOrphans
   * سناریو: پرداخت‌هایی که is_allocated=true ولی invoice_id ندارند یا ledger row ندارند (orphan) را روی فاکتورهای باز نماینده‌شان توزیع می‌کند.
   * پیش‌نیاز: ledger_backfill_mode = active (یا read_only؟ این توزیع درج می‌کند -> active) و dual_write حداقل shadow.
   * الگوریتم FIFO بر اساس قدیمی‌ترین فاکتورهای status IN (unpaid, partial, overdue) با باقی‌مانده مثبت.
   * محدودیت: فعلاً فقط پرداخت‌هایی که invoice_id NULL دارند و ledger نخورده‌اند.
   */
  static async distributePartialOrphans(options?: { paymentLimit?: number; invoiceBatchLimit?: number }): Promise<{ processedPayments: number; createdAllocations: number; skipped: number; state: string }> {
    const backfillState = featureFlagManager.getMultiStageFlagState('ledger_backfill_mode');
    if (backfillState !== 'active') {
      throw new Error(`ledger_backfill_mode باید active باشد (state=${backfillState})`);
    }
    const dualState = featureFlagManager.getMultiStageFlagState('allocation_dual_write');
    if (dualState === 'off') {
      throw new Error(`allocation_dual_write باید حداقل shadow باشد (state=${dualState})`);
    }

    const paymentLimit = options?.paymentLimit ?? 100;
    const invoiceBatchLimit = options?.invoiceBatchLimit ?? 200;

    // مرحله 1: انتخاب پرداخت‌های orphan (allocated=true, invoice_id IS NULL, بدون ledger)
    const orphanPaymentsRes = await db.execute(sql`
      SELECT p.id AS payment_id,
             p.representative_id AS rep_id,
             COALESCE(CASE WHEN p.amount_dec IS NOT NULL THEN p.amount_dec ELSE NULLIF(regexp_replace(p.amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END,0) AS amount
      FROM payments p
      LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
      WHERE p.is_allocated = true
        AND p.invoice_id IS NULL
        AND pa.id IS NULL
      ORDER BY p.id ASC
      LIMIT ${paymentLimit};
    `);
    const orphanRows = (orphanPaymentsRes as any).rows || [];
    if (!orphanRows.length) {
      return { processedPayments: 0, createdAllocations: 0, skipped: 0, state: backfillState };
    }

  let createdAllocations = 0; let skipped = 0; let processedPayments = 0; const touchedInvoices = new Set<number>();

    // گروه‌بندی orphan ها بر اساس representative برای کاهش کوئری
    const byRep = new Map<number, Array<any>>();
    for (const r of orphanRows) {
      const rep = Number(r.rep_id);
      if (!byRep.has(rep)) byRep.set(rep, []);
      byRep.get(rep)!.push(r);
    }

    for (const [repId, paymentsList] of byRep.entries()) {
      // مرحله 2: گرفتن فاکتورهای باز این نماینده با remaining مثبت (remaining = amount - Σallocations)
      // ابتدا فاکتورهای کاندید
      const invoicesRes = await db.execute(sql`
        SELECT i.id AS invoice_id,
               i.amount AS amount,
               COALESCE((SELECT SUM(pa.allocated_amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id),0) AS allocated
        FROM invoices i
        WHERE i.representative_id = ${repId}
          AND i.status IN ('unpaid','partial','overdue')
        ORDER BY i.issue_date ASC, i.id ASC
        LIMIT ${invoiceBatchLimit};
      `);
      const invoiceRows = (invoicesRes as any).rows || [];
      // محاسبه remaining در حافظه
      const fifoInvoices = invoiceRows.map((ir: any) => ({
        invoiceId: Number(ir.invoice_id),
        amount: Number(ir.amount),
        allocated: Number(ir.allocated),
        remaining: Number(ir.amount) - Number(ir.allocated)
      })).filter(inv => inv.remaining > 0.000001);
      if (!fifoInvoices.length) {
        skipped += paymentsList.length;
        processedPayments += paymentsList.length;
        continue;
      }

      // مرحله 3: توزیع هر پرداخت روی صف فاکتورها (FIFO)
      for (const pay of paymentsList) {
        let remainingPay = Number(pay.amount);
        if (remainingPay <= 0) { skipped++; processedPayments++; continue; }
        for (const inv of fifoInvoices) {
          if (remainingPay <= 0) break;
          if (inv.remaining <= 0) continue;
          const allocPortion = Math.min(remainingPay, inv.remaining);
          try {
            await db.insert(paymentAllocations).values({
              paymentId: Number(pay.payment_id),
              invoiceId: inv.invoiceId,
              allocatedAmount: allocPortion,
              method: 'backfill',
              synthetic: true,
              idempotencyKey: `bf:orph:p:${pay.payment_id}:i:${inv.invoiceId}`
            });
            createdAllocations++;
            remainingPay -= allocPortion;
            inv.remaining -= allocPortion;
            touchedInvoices.add(inv.invoiceId);
          } catch (e: any) {
            // احتمال برخورد idempotency یا قید دیگر
            skipped++;
          }
        }
        processedPayments++;
      }
    }
    // Cache sync
    for (const invId of touchedInvoices) {
      try { await InvoiceBalanceCacheService.recompute(invId); } catch {}
    }
    return { processedPayments, createdAllocations, skipped, state: backfillState };
  }
}
