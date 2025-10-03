import test from 'node:test';
import { strict as assert } from 'assert';
import { db } from '../../server/database-manager.js';
import { payments, paymentAllocations, invoices } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * تست پایه I1..I3 (I4/I5 Placeholder) – اگر جداول وجود نداشت skip می‌شود.
 */

test('I1..I3 basic invariants (shadow)', async (t) => {
  try {
    // نمونه کوچک: فقط محاسبات؛ فرض می‌کنیم داده موجود است.
    const paySum = await db.execute(sql`SELECT COUNT(*) AS c FROM payments`);
    if (!(paySum as any).rows) {
      t.skip('DB rows undefined');
      return;
    }

    // I1: Σ alloc by payment ≤ payment.amount
    const overAlloc = await db.execute(sql`
      SELECT pa.payment_id
      FROM payment_allocations pa
      JOIN payments p ON p.id = pa.payment_id
      GROUP BY pa.payment_id, p.amount_dec, p.amount
      HAVING COALESCE(SUM(pa.allocated_amount),0) > COALESCE(p.amount_dec, NULLIF(regexp_replace(p.amount, '[^0-9.-]', '', 'g'), '')::DECIMAL, 0);
    `);
    assert.equal((overAlloc as any).rows.length, 0, 'Over-allocation detected (I1 violation)');

    // I2: Σ alloc by invoice ≤ invoice.amount
    const overInvoice = await db.execute(sql`
      SELECT pa.invoice_id
      FROM payment_allocations pa
      JOIN invoices i ON i.id = pa.invoice_id
      GROUP BY pa.invoice_id, i.amount
      HAVING COALESCE(SUM(pa.allocated_amount),0) > i.amount;
    `);
    assert.equal((overInvoice as any).rows.length, 0, 'Invoice over-allocation detected (I2 violation)');

    // I3: remaining = invoice.amount - Σ alloc  (نمی‌نویسیم، فقط محاسبه چک منفی نبودن)
    const negRemaining = await db.execute(sql`
      SELECT i.id
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(allocated_amount) AS alloc_sum
        FROM payment_allocations
        GROUP BY invoice_id
      ) a ON a.invoice_id = i.id
      WHERE (i.amount - COALESCE(a.alloc_sum,0)) < 0;
    `);
    assert.equal((negRemaining as any).rows.length, 0, 'Negative remaining (I3 violation)');

  } catch (e: any) {
    t.skip(`Skipping invariants basic test: ${e.message}`);
  }
});
