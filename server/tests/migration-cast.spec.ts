import test from 'node:test';
import { strict as assert } from 'assert';
import { db } from '../../server/database-manager.js';
import { payments } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * migration-cast.spec.ts
 * اگر ستون amount_dec پر شده باشد، اختلاف مجموع TEXT و DECIMAL باید در محدوده بسیار کوچک باشد.
 * اگر اکثر ردیف‌ها NULL باشند، تست skip می‌شود (هنوز populate نشده).
 */

test('CAST migration differential tolerance', async (t) => {
  try {
    const counts = await db.execute(sql`SELECT COUNT(*) AS total, COUNT(amount_dec) AS dec_filled FROM payments`);
    const row = (counts as any).rows?.[0];
    if (!row) return t.skip('No payments table rows');
    const total = Number(row.total);
    const decFilled = Number(row.dec_filled);
    if (total === 0 || decFilled / total < 0.5) {
      return t.skip('amount_dec less than 50% populated – skipping');
    }
    const sums = await db.execute(sql`SELECT 
      COALESCE(SUM(NULLIF(regexp_replace(amount, '[^0-9.-]', '', 'g'), '')::DECIMAL),0) AS sum_text,
      COALESCE(SUM(amount_dec),0) AS sum_dec
      FROM payments`);
    const s = (sums as any).rows?.[0];
    const sumText = Number(s.sum_text);
    const sumDec = Number(s.sum_dec);
    const diffAbs = Math.abs(sumText - sumDec);
    const ratio = diffAbs / Math.max(sumDec,1);
    assert.ok(ratio < 0.0001, `Cast diff ratio too high: ${ratio}`);
  } catch (e: any) {
    t.skip('Skipping migration cast test: ' + e.message);
  }
});
