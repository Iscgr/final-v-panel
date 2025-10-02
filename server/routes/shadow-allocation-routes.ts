import type { Express, Request, Response } from 'express';
import { db } from '../db.js';
import { payments, invoices, paymentAllocations } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';
import { featureFlagManager } from '../services/feature-flag-manager.js';

/**
 * Shadow Allocation Routes (Phase A - Iteration 3)
 * Endpoint فقط خواندنی برای مشاهده وضعیت dual-write در حالت shadow.
 * مسیر: GET /api/allocations/shadow
 * خروجی: خلاصه sums، تعداد، و لیست محدود ردیف‌ها برای بازرسی.
 */
export function registerShadowAllocationRoutes(app: Express, authMiddleware: any) {
  app.get('/api/allocations/shadow', authMiddleware, async (req: Request, res: Response) => {
    try {
      const dualState = featureFlagManager.getMultiStageFlagState('allocation_dual_write');
      if (dualState === 'off') {
        return res.status(409).json({
          success: false,
          message: 'dual_write در حالت off است. ابتدا آن را به shadow تغییر دهید.',
          state: dualState
        });
      }

      // جمع legacy (پرداخت‌های allocated)
      const legacySumRes = await db.execute(sql`SELECT COALESCE(SUM(CASE WHEN amount_dec IS NOT NULL THEN amount_dec ELSE NULLIF(regexp_replace(amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END),0) AS s, COUNT(*) AS c FROM payments WHERE is_allocated = true`);
      const ledgerSumRes = await db.execute(sql`SELECT COALESCE(SUM(allocated_amount),0) AS s, COUNT(*) AS c FROM payment_allocations`);

      const legacyAllocatedSum = Number((legacySumRes as any).rows?.[0]?.s || 0);
      const legacyAllocatedCount = Number((legacySumRes as any).rows?.[0]?.c || 0);
      const ledgerAllocatedSum = Number((ledgerSumRes as any).rows?.[0]?.s || 0);
      const ledgerAllocatedCount = Number((ledgerSumRes as any).rows?.[0]?.c || 0);
      const diffAbs = Math.abs(legacyAllocatedSum - ledgerAllocatedSum);
      const diffRatio = diffAbs / Math.max(legacyAllocatedSum, 1);

      // نمونه 25 ردیف اخیر ledger برای بازرسی
      const recent = await db.execute(sql`SELECT pa.id, pa.payment_id, pa.invoice_id, pa.allocated_amount, pa.method, pa.created_at FROM payment_allocations pa ORDER BY pa.id DESC LIMIT 25`);

      res.json({
        success: true,
        mode: dualState,
        summary: {
          legacyAllocatedSum,
          legacyAllocatedCount,
            ledgerAllocatedSum,
          ledgerAllocatedCount,
          diffAbs,
          diffRatio
        },
        recent: (recent as any).rows
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Phase B: مشاهده خطوط تخصیص (usage lines) - ترکیب payment_allocations + پرداخت‌های legacy
  app.get('/api/allocations/lines', authMiddleware, async (req: Request, res: Response) => {
    try {
      const visibilityState = featureFlagManager.getMultiStageFlagState('usage_line_visibility');
      if (visibilityState === 'off') {
        return res.status(403).json({ success: false, error: 'usage_line_visibility خاموش است' });
      }
      const limit = Math.min(parseInt(String(req.query.limit || '100')), 500);
      // آخرین خطوط ledger
      const ledgerRows = await db.execute(sql`SELECT pa.id, pa.payment_id, pa.invoice_id, pa.allocated_amount, pa.method, pa.synthetic, pa.created_at FROM payment_allocations pa ORDER BY pa.id DESC LIMIT ${limit}`);
      // پرداخت‌های legacy allocated (برای مرجع) - بدون join پیچیده
      const legacyRows = await db.execute(sql`SELECT p.id AS payment_id, p.invoice_id, CASE WHEN p.amount_dec IS NOT NULL THEN p.amount_dec ELSE NULLIF(regexp_replace(p.amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END AS amount_dec, p.is_allocated, p.created_at FROM payments p WHERE p.is_allocated = true ORDER BY p.id DESC LIMIT ${limit}`);
      res.json({
        success: true,
        ledger: (ledgerRows as any).rows,
        legacy: (legacyRows as any).rows,
        meta: { limit, visibility: visibilityState }
      });
    } catch (e:any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}
