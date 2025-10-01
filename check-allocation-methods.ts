#!/usr/bin/env tsx
/**
 * بررسی فیلد method در جدول payment_allocations
 * برای تصمیم‌گیری درباره migration
 */

import { db } from './server/database-manager.js';
import { sql } from 'drizzle-orm';

async function checkAllocationMethods() {
  console.log('🔍 بررسی فیلد method در payment_allocations...\n');

  try {
    // 1. تعداد کل رکوردها
    const totalResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM payment_allocations;
    `);
    const total = (totalResult.rows[0] as any).total;
    console.log(`📊 کل رکوردها: ${total}`);

    if (total === '0' || total === 0) {
      console.log('✅ جدول خالی است - نیازی به migration نیست\n');
      process.exit(0);
    }

    // 2. گروه‌بندی بر اساس method
    const methodsResult = await db.execute(sql`
      SELECT 
        method, 
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / ${total}, 2) as percentage
      FROM payment_allocations 
      GROUP BY method 
      ORDER BY count DESC;
    `);

    console.log('\n📈 توزیع methods:');
    console.log('─'.repeat(60));
    for (const row of methodsResult.rows) {
      const r = row as any;
      console.log(`  ${r.method.padEnd(12)} | ${String(r.count).padStart(8)} رکورد | ${String(r.percentage).padStart(6)}%`);
    }
    console.log('─'.repeat(60));

    // 3. نمونه‌ای از رکوردهای auto (اگر وجود دارد)
    const autoSamples = await db.execute(sql`
      SELECT 
        pa.id,
        pa.payment_id,
        pa.invoice_id,
        pa.allocated_amount,
        pa.method,
        pa.created_at,
        p.amount as payment_amount,
        i.invoice_number
      FROM payment_allocations pa
      LEFT JOIN payments p ON p.id = pa.payment_id
      LEFT JOIN invoices i ON i.id = pa.invoice_id
      WHERE pa.method = 'auto'
      LIMIT 5;
    `);

    if (autoSamples.rows.length > 0) {
      console.log('\n🔍 نمونه رکوردهای auto (5 مورد اول):');
      console.log('─'.repeat(80));
      for (const row of autoSamples.rows) {
        const r = row as any;
        console.log(`  ID: ${r.id} | Payment: ${r.payment_id} (${r.payment_amount}) -> Invoice: ${r.invoice_number} | Amount: ${r.allocated_amount}`);
      }
      console.log('─'.repeat(80));
    }

    // 4. بررسی آیا synthetic flag استفاده شده؟
    const syntheticCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM payment_allocations WHERE synthetic = true;
    `);
    const syntheticTotal = (syntheticCount.rows[0] as any).count;
    console.log(`\n🏷️  رکوردهای synthetic: ${syntheticTotal}`);

    // 5. توصیه‌های migration
    console.log('\n📋 توصیه‌ها:');
    console.log('─'.repeat(60));
    
    const autoCount = methodsResult.rows.find((r: any) => r.method === 'auto');
    if (autoCount && Number((autoCount as any).count) > 0) {
      console.log('⚠️  رکوردهای auto موجود هستند!');
      console.log('   گزینه 1: تبدیل همه به "manual" (ساده‌تر)');
      console.log('   گزینه 2: تبدیل به "legacy_auto" (حفظ تاریخچه)');
      console.log('   گزینه 3: علامت‌گذاری synthetic=true (پیشنهادی)');
    } else {
      console.log('✅ رکوردی با method="auto" وجود ندارد');
      console.log('   هیچ migration لازم نیست');
    }
    console.log('─'.repeat(60));

  } catch (error) {
    console.error('❌ خطا:', error);
    process.exit(1);
  }

  process.exit(0);
}

checkAllocationMethods();
