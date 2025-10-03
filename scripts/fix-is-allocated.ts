/**
 * Fix script: Update is_allocated for payments that have allocations
 */

import { db } from '../server/database-manager.js';
import { sql } from 'drizzle-orm';

async function fixIsAllocatedFlag() {
  console.log('🔧 شروع اصلاح فلگ is_allocated برای payments موجود...\n');

  try {
    // یافتن payments که allocation دارند اما is_allocated = false است
    const result = await db.execute(sql`
      UPDATE payments
      SET is_allocated = true
      WHERE id IN (
        SELECT DISTINCT payment_id 
        FROM payment_allocations
      )
      AND is_allocated = false
      RETURNING id, representative_id, amount
    `);

    console.log(`✅ تعداد ${result.rows.length} payment آپدیت شد:\n`);
    
    result.rows.forEach((row: any) => {
      console.log(`   - Payment ID: ${row.id}, Representative: ${row.representative_id}, Amount: ${row.amount}`);
    });

    console.log(`\n✅ اصلاح با موفقیت انجام شد!`);

  } catch (error) {
    console.error('❌ خطا در اجرای script:', error);
  } finally {
    process.exit(0);
  }
}

fixIsAllocatedFlag();
