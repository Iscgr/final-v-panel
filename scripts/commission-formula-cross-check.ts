#!/usr/bin/env tsx
/**
 * Cross-check فرمول کمیسیون (Phase 2 Checklist)
 * محاسبه: expectedCommission = totalSales * (commissionRate/100)
 * مقایسه با:
 *  - مجموع پرداخت‌های ثبت‌شده (amount) در وضعیت paid + settledAmount در pending ها
 * آستانه انحراف (tolerancePercent) قابل تنظیم.
 * خروجی: JSON شامل deviations و خلاصه.
 */
import { db } from '../server/db.js';
import { salesPartners, partnerCommissionPayments } from '../shared/schema.js';
import { sql, eq } from 'drizzle-orm';

interface PartnerRow {
  id: number;
  name: string;
  commissionRate: string | null;
  totalSales: string | null;
}

(async () => {
  const tolerancePercent = Number(process.env.COMMISSION_TOLERANCE_PERCENT || '1'); // 1% پیش‌فرض

  const partners: PartnerRow[] = await db.select({
    id: salesPartners.id,
    name: salesPartners.name,
    commissionRate: salesPartners.commissionRate,
    totalSales: (salesPartners as any).totalSales // فرض: فیلد محاسباتی ذخیره شده (در صورت نبود، 0)
  }).from(salesPartners);

  const results: any[] = [];

  for (const p of partners) {
    const rate = Number(p.commissionRate || 0);
    const totalSales = Number(p.totalSales || 0);
    const expected = (totalSales * rate) / 100;

    // مجموع پرداخت‌های نهایی شده (paid)
    const paidRows: any[] = await db.select().from(partnerCommissionPayments)
      .where(eq((partnerCommissionPayments as any).salesPartnerId, p.id));

    let aggregate = 0;
    for (const row of paidRows) {
      const status = (row as any).status || 'pending';
      const amount = Number(row.amount || 0);
      const settledAmount = Number((row as any).settledAmount || 0);
      if (status === 'paid') {
        // اگر paid و settledAmount < amount (سناریوی نادر) amount مبنا قرار می‌گیرد.
        aggregate += Math.max(settledAmount, amount);
      } else if (status === 'pending') {
        // فقط portion تسویه‌شده را لحاظ می‌کنیم
        aggregate += settledAmount;
      }
      // cancelled نادیده گرفته می‌شود
    }

    const diff = aggregate - expected;
    const diffAbs = Math.abs(diff);
    const diffPercent = expected === 0 ? 0 : (diffAbs / expected) * 100;
    const withinTolerance = diffPercent <= tolerancePercent;

    if (!withinTolerance) {
      results.push({
        partnerId: p.id,
        partnerName: p.name,
        rate,
        totalSales,
        expected: expected.toFixed(2),
        actual: aggregate.toFixed(2),
        diff: diff.toFixed(2),
        diffPercent: diffPercent.toFixed(2),
        status: 'DEVIATION'
      });
    }
  }

  const summary = {
    partners: partners.length,
    deviations: results.length,
    tolerancePercent,
    generatedAt: new Date().toISOString()
  };

  const output = { summary, deviations: results };
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
})().catch(err => {
  console.error('commission-formula-cross-check FAIL', err);
  process.exit(1);
});
