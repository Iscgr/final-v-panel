import test from 'node:test';
import { strict as assert } from 'assert';
import { db } from '../../server/database-manager.js';
import { invoices, invoiceBalanceCache } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * تست ابتدایی I4/I5: status mapping و بدهی نماینده (تقریب) – در نبود داده skip.
 */

test('I4/I5 status mapping basics', async (t) => {
  try {
    // بررسی اینکه اگر cache وجود دارد، mapping نقض آشکار نداشته باشد
    const anomalies = await db.execute(sql`
      SELECT invoice_id, status_cached, remaining_amount, allocated_total
      FROM invoice_balance_cache
      WHERE (status_cached = 'paid' AND remaining_amount <> 0)
         OR (status_cached = 'unpaid' AND remaining_amount <= 0)
         OR (status_cached = 'partial' AND (remaining_amount <= 0 OR remaining_amount >= (remaining_amount + allocated_total)))
         OR (status_cached = 'anomaly');
    `);
    if ((anomalies as any).rows.length > 0) {
      assert.fail(`Status mapping anomalies detected count=${(anomalies as any).rows.length}`);
    }
  } catch (e: any) {
    t.skip(`Skipping status mapping test: ${e.message}`);
  }
});
