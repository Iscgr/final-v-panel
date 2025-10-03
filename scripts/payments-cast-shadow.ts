#!/usr/bin/env tsx
/**
 * payments-cast-shadow.ts
 * Phase A - Iteration 6
 * وظیفه: اسکن ستون TEXT مبلغ پرداخت‌ها، تلاش برای CAST ایمن به DECIMAL و گزارش انحراف مجموع.
 * حالت پیش‌فرض: --dry-run (فقط گزارش). با --apply مقدار ستون amount_dec را پر می‌کند اگر null باشد.
 */
import { db } from '../server/database-manager.js';
import { payments } from '@shared/schema';
import { sql } from 'drizzle-orm';

interface CastStats {
  total: number;
  alreadyDecimal: number;
  converted: number;
  wouldConvert: number; // فقط در dry-run: تعداد ردیف‌هایی که در apply تبدیل خواهند شد
  invalid: number;
  sumText: number;
  sumDecimal: number;
  sumDiffAbs: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    apply: args.includes('--apply'),
    finalize: args.includes('--finalize'),
    limit: (() => { const i = args.indexOf('--limit'); return i>=0 ? Number(args[i+1]) : undefined; })(),
    verbose: args.includes('--verbose')
  };
}

async function main() {
  const { apply, finalize, limit, verbose } = parseArgs();
  const stats: CastStats = { total:0, alreadyDecimal:0, converted:0, wouldConvert:0, invalid:0, sumText:0, sumDecimal:0, sumDiffAbs:0 };

  const rows = await db.execute(sql`
    SELECT id, amount, amount_dec FROM payments
    ${limit ? sql`LIMIT ${limit}` : sql``};
  `);
  const data = (rows as any).rows || [];
  for (const r of data) {
    stats.total++;
    const raw = String(r.amount || '');
    const existingDec = r.amount_dec !== null && r.amount_dec !== undefined;
    if (existingDec) stats.alreadyDecimal++;
    const cleaned = raw.replace(/[^0-9.\-]/g,'');
    if (!cleaned || cleaned === '-' || cleaned === '.' ) { stats.invalid++; continue; }
    const num = Number(cleaned);
    if (Number.isNaN(num)) { stats.invalid++; continue; }
    stats.sumText += num;
    if (existingDec) {
      stats.sumDecimal += Number(r.amount_dec);
      continue;
    }
    // در حالت اعمال: بروزرسانی فقط ردیف‌هایی که amount_dec خالی است
    if (apply) {
      try {
        await db.execute(sql`UPDATE payments SET amount_dec = ${num} WHERE id = ${r.id} AND amount_dec IS NULL`);
        stats.converted++;
        stats.sumDecimal += num;
      } catch {
        stats.invalid++;
      }
    } else {
      // پیش‌بینی برای dry-run
      stats.sumDecimal += num;
      stats.wouldConvert++;
    }
  }
  stats.sumDiffAbs = Math.abs(stats.sumText - stats.sumDecimal);

  const tolerance = 0.0001; // در فاز A: اختلاف مجموع باید نزدیک صفر باشد (0.01%)
  const diffRatio = stats.sumDecimal === 0 ? 0 : (stats.sumDiffAbs / Math.max(stats.sumDecimal,1));
  const withinTolerance = stats.sumDecimal === 0 ? true : diffRatio < tolerance;

  // مرحله نهایی: فقط اگر finalize و بدون apply اجرا شود عمل «علامت آماده‌سازی» را ثبت می‌کنیم.
  // (اختیاری: در آینده می‌توان rename ستون اصلی را نیز اینجا انجام داد)
  if (finalize) {
    if (!withinTolerance) {
      console.error('❌ نمی‌توان finalize کرد: اختلاف مجموع خارج از تلورانس است.');
      process.exit(2);
    }
    // در این نسخه تنها پیام علامت نهایی چاپ می‌شود؛ مهاجرت rename واقعی ممکن است به migration جدا منتقل شود.
  }

  const report = {
    mode: finalize ? 'FINALIZE' : (apply ? 'APPLY' : 'DRY_RUN'),
    ...stats,
    tolerance,
    diffRatio,
    withinTolerance
  };
  console.log(JSON.stringify(report,null,2));
  if (!withinTolerance && apply) {
    console.warn('⚠️ مجموع اختلاف از تلورانس بالاتر است – بررسی دستی لازم.');
  }
  if (finalize && withinTolerance) {
    console.log('✅ CAST migration validated. Ready for column swap migration (follow-up DDL required).');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
