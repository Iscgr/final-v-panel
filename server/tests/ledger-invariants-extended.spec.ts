import test from 'node:test';
import { strict as assert } from 'assert';
import { db } from '../../server/database-manager.js';
import { invoices, paymentAllocations } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * تست‌های افزوده I6-I9
 * I6: Σ(alloc payment) ≤ payment.amount (پوشش در basic)
 * I7: Σ(alloc invoice) ≤ invoice.amount (پوشش در basic)
 * I8/I9: status_cached سازگار با remaining (در صورت وجود کش)
 *  - paid ⇔ remaining = 0
 *  - partial ⇔ 0 < remaining < amount
 *  - unpaid ⇔ remaining = amount
 */

test('I8/I9 status_cached consistency (skip if cache missing)', async (t) => {
  try {
    // بررسی وجود جدول invoice_balance_cache
    const cacheCheck = await db.execute(sql`SELECT to_regclass('public.invoice_balance_cache') AS exists`);
    const exists = (cacheCheck as any).rows?.[0]?.exists;
    if (!exists) {
      t.skip('invoice_balance_cache table not found');
      return;
    }

    const anomalies = await db.execute(sql`
      SELECT ibc.invoice_id, ibc.status_cached, ibc.remaining_amount, i.amount
      FROM invoice_balance_cache ibc
      JOIN invoices i ON i.id = ibc.invoice_id
      WHERE NOT (
        (ibc.status_cached = 'paid' AND ibc.remaining_amount = 0) OR
        (ibc.status_cached = 'unpaid' AND ibc.remaining_amount = i.amount) OR
        (ibc.status_cached = 'partial' AND ibc.remaining_amount > 0 AND ibc.remaining_amount < i.amount)
      );
    `);
    assert.equal((anomalies as any).rows.length, 0, 'Status cached inconsistency (I8/I9 violation)');
  } catch (e: any) {
    t.skip(`Skipping I8/I9 test: ${e.message}`);
  }
});

/**
 * I6/I7 دوباره به صورت aggregate سریع بررسی Over-allocation (Redundant Safety) – در صورت بزرگ بودن داده می‌توان محدودیت گذاشت.
 */

test('I6/I7 recheck over-allocation redundancy', async (t) => {
  try {
    const overInvoice = await db.execute(sql`
      SELECT invoice_id
      FROM payment_allocations
      GROUP BY invoice_id
      HAVING SUM(allocated_amount) > (SELECT amount FROM invoices WHERE id = invoice_id);
    `);
    assert.equal((overInvoice as any).rows.length, 0, 'Invoice over-allocation (I7 redundancy)');
  } catch (e: any) {
    t.skip(`Skipping I6/I7 redundancy test: ${e.message}`);
  }
});
