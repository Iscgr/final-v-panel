/**
 * AllocationService (Phase A - Iteration 2)
 * Wrapper روی منطق legacy تخصیص برای افزودن نوشتن shadow در ledger هنگام فعال بودن flag.
 * اصل: بدون تغییر رفتار بیرونی، فقط افزودن observability و زیرساخت آینده.
 */
import { db } from '../database-manager';
import { payments, invoices, paymentAllocations } from '@shared/schema';
import { validateAllocations } from './allocation-invariants.js';
import { GuardMetricsService } from './guard-metrics-service.js';
import { eq, and, sql } from 'drizzle-orm';
import { featureFlagManager } from './feature-flag-manager.js';
import { isCanaryRepresentative } from './allocation-canary-helper.js';
import { InvoiceBalanceCacheService } from './invoice-balance-cache-service.js';
import { stableIdempotencyKey } from '../utils/crypto-hash';

export interface AllocationResultShadow {
  legacyUpdated: boolean;
  ledgerInserted?: boolean;
  mode: 'legacy-only' | 'dual-shadow' | 'dual-enforce';
  messages: string[];
}

function parseAmountText(amountText: string): number {
  // حذف کاراکترهای غیرعددی (ممکن است مبلغ با کاما یا فضای ناخواسته بیاید)
  const cleaned = amountText.replace(/[^0-9.\-]/g, '');
  const num = Number(cleaned);
  if (Number.isNaN(num)) throw new Error(`Invalid amount TEXT value: '${amountText}'`);
  return num;
}

export class AllocationService {
  /**
   * تخصیص کامل پرداخت به یک فاکتور (مطابق رفتار فعلی)
   * - در حالت shadow: رکورد ledger ثبت می‌شود ولی نتیجه خوانش سیستم تغییر نمی‌کند.
   * - در enforce (بعداً): مسیر legacy به تدریج حذف خواهد شد (اما اکنون فقط مسیر افزایشی است).
   */
  static async allocateFull(paymentId: number, invoiceId: number, performedBy?: number): Promise<AllocationResultShadow> {
    // استفاده از multi-stage flag جدید
    const dualState = featureFlagManager.getMultiStageFlagState('allocation_dual_write');
    const mode: AllocationResultShadow['mode'] = dualState === 'off'
      ? 'legacy-only'
      : (dualState === 'shadow' ? 'dual-shadow' : 'dual-enforce');

    // حالت گاردها (I6/I7)
    const guardState = featureFlagManager.getMultiStageFlagState('allocation_runtime_guards');

    const messages: string[] = [];

    return await db.transaction(async (tx) => {
      // 1. Load payment & invoice (FOR UPDATE semantic در Postgres در آینده: drizzle lacks direct; could use sql`FOR UPDATE` custom)
      const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId));
      if (!payment) throw new Error('Payment not found');
      const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) throw new Error('Invoice not found');

      // Canary read switch (Phase A - Iteration 6 extension): اگر allocation_read_switch روی canary باشد و representative در نمونه باشد
      // می‌توانیم لاگ مشاهده‌ای درج کنیم (رفتار تخصیص فعلاً تغییر نمی‌کند؛ فقط نقطه‌ی مشاهده‌ای برای آینده).
      const readSwitchState = featureFlagManager.getMultiStageFlagState('allocation_read_switch');
      if (readSwitchState === 'canary') {
        const repId = invoice.representativeId || payment.representativeId;
        if (repId && isCanaryRepresentative(Number(repId), 5)) {
          messages.push('CanaryRead: representative selected for ledger-first observation');
        }
      }

      // Legacy guard: پرداخت قبلاً تخصیص یافته؟
      if (payment.isAllocated) {
        messages.push('Payment already allocated (legacy flag)');
        return { legacyUpdated: false, mode, messages };
      }

      // Full allocation semantics فعلی: فقط اگر مبلغ پرداخت == مبلغ فاکتور؟ (legacy مدل ممکن است انعطاف نداشته باشد)
      const paymentAmount = payment.amountDec ? Number(payment.amountDec) : parseAmountText(payment.amount);
      const invoiceAmount = Number(invoice.amount);

      if (paymentAmount !== invoiceAmount) {
        // رفتار legacy: احتمالاً رد یا فقط ست isAllocated=true? فعلاً پیام ثبت و ادامه (عدم شکست برای مشاهده سایه)
        messages.push(`Amount mismatch legacy model (payment=${paymentAmount} invoice=${invoiceAmount}) - still proceeding for shadow write`);
      }

      // 2. (پیش از legacy update) گاردهای زمان اجرا برای جلوگیری از over-allocation:
      if (guardState !== 'off') {
        // مجموع تخصیص‌های موجود این پرداخت (نباید وجود داشته باشد در مدل فعلی، ولی دفاعی)
        const existingPayAlloc = await tx.execute(sql`SELECT COALESCE(SUM(allocated_amount),0) AS s FROM payment_allocations WHERE payment_id = ${paymentId}`);
        const paymentAllocatedSum = Number((existingPayAlloc as any).rows?.[0]?.s || 0);
        const prospectivePaymentTotal = paymentAllocatedSum + paymentAmount;
        if (prospectivePaymentTotal - paymentAmount > 0.000001 && paymentAllocatedSum > 0) {
          messages.push(`Guard anomaly: payment already has allocations sum=${paymentAllocatedSum}`);
        }
        if (prospectivePaymentTotal - paymentAmount > 0.000001) {
          // (در مدل فعلی رخ نمی‌دهد؛ برای آینده partial) => over-payment allocation
          const msg = `Over-allocation detected for payment ${paymentId}: prospective=${prospectivePaymentTotal} > paymentAmount=${paymentAmount}`;
          if (guardState === 'enforce') {
            throw new Error(msg);
          } else {
            console.warn('[GUARD][WARN]', msg);
            messages.push(msg);
          }
        }

        // مجموع تخصیص‌های فعلی فاکتور
        const existingInvAlloc = await tx.execute(sql`SELECT COALESCE(SUM(allocated_amount),0) AS s FROM payment_allocations WHERE invoice_id = ${invoiceId}`);
        const invoiceAllocatedSum = Number((existingInvAlloc as any).rows?.[0]?.s || 0);
        const prospectiveInvoiceTotal = invoiceAllocatedSum + paymentAmount;
        const invoiceAmountNum = invoiceAmount;
        if (prospectiveInvoiceTotal - invoiceAmountNum > 0.000001) {
          const overAmt = prospectiveInvoiceTotal - invoiceAmountNum;
            const msg = `Over-allocation detected for invoice ${invoiceId}: prospective=${prospectiveInvoiceTotal} > invoiceAmount=${invoiceAmountNum} (excess=${overAmt})`;
            if (guardState === 'enforce') {
              throw new Error(msg);
            } else {
              console.warn('[GUARD][WARN]', msg);
              messages.push(msg);
            }
        }
      }

      // 3. Legacy update
      const [updatedPayment] = await tx.update(payments)
        .set({ isAllocated: true, invoiceId })
        .where(and(eq(payments.id, paymentId)))
        .returning();

      messages.push('Legacy payment updated (isAllocated=true)');

      let ledgerInserted: boolean | undefined = undefined;

      if (mode === 'dual-shadow' || mode === 'dual-enforce') {
        try {
          await tx.insert(paymentAllocations).values({
            paymentId: paymentId,
            invoiceId: invoiceId,
            allocatedAmount: paymentAmount, // full allocation legacy assumption
            method: 'manual',
            synthetic: false,
            performedBy: performedBy,
            idempotencyKey: `p:${paymentId}-i:${invoiceId}`
          });
          ledgerInserted = true;
          messages.push('Ledger shadow row inserted');
          // Cache sync (on-write strategy - D9) فقط در صورت موفقیت درج
          try {
            await InvoiceBalanceCacheService.recompute(invoiceId);
            messages.push('Invoice balance cache recomputed');
          } catch (e:any) {
            messages.push('Cache recompute failed: ' + e.message);
          }
        } catch (e: any) {
          ledgerInserted = false;
          messages.push(`Ledger insert failed: ${e.message}`);
        }
      }

      // enforce mode در آینده باید کش را نیز آپدیت کند (invoice_balance_cache) – فعلاً صرفاً پیام
      if (mode === 'dual-enforce') {
        messages.push('Enforce mode placeholder: cache update pending future iteration');
      }

      return { legacyUpdated: !!updatedPayment, ledgerInserted, mode, messages };
    });
  }

  static async calculateDebt(representativeId) {
    const readSwitchState = featureFlagManager.getMultiStageFlagState('allocation_read_switch');
    const useLedger = readSwitchState === 'full' || (readSwitchState === 'canary' && isCanaryRepresentative(representativeId, 5));
    if (useLedger) {
      // خواندن ledger-aware (cache اول، سپس fallback محاسبه مستقیم اگر cache خالی باشد)
      const res = await InvoiceBalanceCacheService.getRepresentativeDebtLedgerAware(representativeId);
      return res.debt;
    } else {
      // fallback قدیمی
      const invoiceBalance = await db.execute(sql`SELECT COALESCE(SUM(amount), 0) as balance FROM invoices WHERE representative_id = ${representativeId}`);
      return Number((invoiceBalance as any).rows?.[0]?.balance || 0);
    }
  }

  /**
   * allocatePartial (Phase B – Skeleton)
   * - فقط در حالت allocation_partial_mode != off فعال می‌شود.
   * - هیچ تغییری در legacy isAllocated پرداخت ایجاد نمی‌کند (shadow-only رفتار).
   * - ورودی lines: آرایه‌ای از { invoiceId, amount }
   * - اینورینت گارد: Σ(amount) ≤ مبلغ پرداخت، Σ(amount) ≤ remaining هر فاکتور.
   */
  static async allocatePartial(paymentId: number, lines: Array<{ invoiceId: number; amount: number; idempotencyKey?: string }>, performedBy?: number) {
    const partialMode = featureFlagManager.getMultiStageFlagState('allocation_partial_mode');
    if (partialMode === 'off') {
      throw new Error('Partial allocation feature is OFF');
    }
    if (!Array.isArray(lines) || !lines.length) throw new Error('lines array required');

    return await db.transaction(async (tx) => {
  const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId));
      if (!payment) throw new Error('Payment not found');
      const paymentBaseAmount = payment.amountDec ? Number(payment.amountDec) : parseAmountText(payment.amount);

      // جمع ورودی
      // جمع مبلغ تخصیص قبلی این پرداخت (ledger)
      const existingPayAlloc = await tx.execute(sql`SELECT COALESCE(SUM(allocated_amount),0) AS s FROM payment_allocations WHERE payment_id = ${paymentId}`);
      const alreadyAllocatedPayment = Number((existingPayAlloc as any).rows?.[0]?.s || 0);

      // آماده‌سازی snapshots فاکتورها برای validator
      const invoiceIds = [...new Set(lines.map(l => l.invoiceId))];
      const invoiceSnaps = [] as any[];
      for (const invId of invoiceIds) {
        const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invId));
        if (!inv) continue;
        const invoiceAllocRes = await tx.execute(sql`SELECT COALESCE(SUM(allocated_amount),0) AS s FROM payment_allocations WHERE invoice_id = ${invId}`);
        const alreadyAllocatedInvoice = Number((invoiceAllocRes as any).rows?.[0]?.s || 0);
        invoiceSnaps.push({ invoiceId: invId, invoiceAmount: Number(inv.amount), alreadyAllocatedInvoice });
      }

      const guardState = featureFlagManager.getMultiStageFlagState('allocation_runtime_guards');
      const validation = validateAllocations(
        { paymentId, paymentAmount: paymentBaseAmount, alreadyAllocatedPayment },
        invoiceSnaps,
        lines.map(l => ({ invoiceId: l.invoiceId, amount: Number(l.amount), idempotencyKey: l.idempotencyKey })),
        { tolerance: 1e-6 }
      );

      if (!validation.ok) {
        // ثبت هر violation به صورت جداگانه
        validation.violations.forEach(v => GuardMetricsService.record(v, { paymentId, mode: partialMode }));
        if (guardState === 'enforce') {
          GuardMetricsService.record('ENFORCE_BLOCK', { paymentId });
          throw new Error('Allocation validation failed: ' + validation.violations.join('|'));
        } else if (guardState === 'warn') {
          console.warn('[ALLOC_GUARD][WARN]', validation.violations);
        }
      }

      const messages: string[] = [];
      let inserted = 0; let skipped = 0; let anomalies = 0;
      const touchedInvoiceIds: number[] = [];
      for (const line of lines) {
  const amount = Number(line.amount);
        if (!(amount > 0)) { skipped++; continue; }
        // remaining فاکتور را محاسبه کنیم (cache → fallback aggregate)
        const [inv] = await tx.select().from(invoices).where(eq(invoices.id, line.invoiceId));
        if (!inv) { skipped++; messages.push(`Invoice ${line.invoiceId} not found`); continue; }
        const invoiceAllocRes = await tx.execute(sql`SELECT COALESCE(SUM(allocated_amount),0) AS s FROM payment_allocations WHERE invoice_id = ${line.invoiceId}`);
        const alreadyAllocated = Number((invoiceAllocRes as any).rows?.[0]?.s || 0);
        const invoiceAmountNum = Number(inv.amount);
        const remaining = invoiceAmountNum - alreadyAllocated;
        if (amount - remaining > 0.000001) {
          const msg = `Line over remaining invoice=${line.invoiceId} amount=${amount} remaining=${remaining}`;
          anomalies++;
          if (partialMode === 'enforce') throw new Error(msg); else { messages.push(msg); continue; }
        }
        try {
          await tx.insert(paymentAllocations).values({
            paymentId,
            invoiceId: line.invoiceId,
            allocatedAmount: amount,
            method: 'manual',
            synthetic: false,
            performedBy,
            idempotencyKey: line.idempotencyKey || stableIdempotencyKey(paymentId, line.invoiceId, amount)
          });
          inserted++;
          // حذف recompute تکی؛ فقط شناسه را برای batch بعد از حلقه ذخیره می‌کنیم
          if (!touchedInvoiceIds.includes(line.invoiceId)) touchedInvoiceIds.push(line.invoiceId);
        } catch (e:any) {
          messages.push(`Insert fail invoice=${line.invoiceId}: ${e.message}`);
        }
      }
      // اجرای batch recompute خارج از حلقه برای کاهش round-trip ها
      if (touchedInvoiceIds.length) {
        try {
          const { processed, errors } = await InvoiceBalanceCacheService.recomputeBatch(touchedInvoiceIds);
          messages.push(`Batch cache recompute processed=${processed} errors=${errors}`);
        } catch (e:any) {
          messages.push('Batch cache recompute failed: ' + e.message);
        }
      }
      return { paymentId, mode: partialMode, guardState, inserted, skipped, anomalies, messages, validation };
    });
  }
}
