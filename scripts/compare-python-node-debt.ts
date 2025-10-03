/**
 * Comparison Harness: Python vs Node Debt Consistency (E-D6)
 * هدف: سنجش انحراف (drift) بدهی نمایندگان بین موتور Node و سرویس Python
 * خروجی: JSON خلاصه تفاوت‌ها جهت استفاده در CI یا تحلیل دستی
 *
 * Metrics:
 *  - max_diff: بیشترین اختلاف عددی
 *  - avg_ppm: میانگین اختلاف Part Per Million نسبت به بدهی Node (مبنای اصلی فعلاً)
 *  - representative_count: تعداد نمایندگان بررسی شده
 *  - worst: لیست 5 نماینده با بیشترین اختلاف (مرتب‌شده)
 *  - zero_debt_mismatch_count: تعداد مواردی که یکی صفر است و دیگری نه
 *
 * نحوه اجرا:
 *  node -r ts-node/register scripts/compare-python-node-debt.ts [--limit=50] [--json]
 *  یا اگر tsx نصب است:
 *  npx tsx scripts/compare-python-node-debt.ts --limit=100 --json
 */

import { db } from '../server/database-manager.js';
import { representatives } from '@shared/schema';
import { pythonFinancialClient } from '../server/services/python-financial-client.js';
import { UnifiedFinancialEngine } from '../server/services/unified-financial-engine.js';
import { sql } from 'drizzle-orm';

interface DriftRow {
  representative_id: number;
  node_debt: number;
  python_debt: number;
  diff: number;       // absolute difference
  ppm: number;        // diff / baseline * 1e6
}

interface HarnessResult {
  timestamp: string;
  representative_count: number;
  max_diff: number;
  max_ppm: number;
  avg_ppm: number;
  zero_debt_mismatch_count: number;
  worst: DriftRow[];
  sample: DriftRow[]; // first 5 for quick glance
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: { limit?: number; json?: boolean } = {};
  for (const a of args) {
    if (a.startsWith('--limit=')) opts.limit = parseInt(a.split('=')[1], 10);
    else if (a === '--json') opts.json = true;
  }
  return opts;
}

async function main() {
  const { limit = 100, json = false } = parseArgs();
  const start = Date.now();

  // Collect representative IDs
  const reps = await db.select({ id: representatives.id })
    .from(representatives)
    .orderBy(sql`id ASC`)
    .limit(limit);

  const ids = reps.map(r => r.id);
  if (!ids.length) {
    console.error('هیچ نماینده‌ای برای مقایسه یافت نشد');
    process.exit(1);
  }

  // Node calculations (sequential to reuse cache fairly minimal; can parallelize later)
  const nodeResults: Record<number, number> = {};
  for (const id of ids) {
    try {
      const data = await UnifiedFinancialEngine.calculateRepresentativeStatic(id);
      nodeResults[id] = data.actualDebt;
    } catch (err) {
      console.warn('خطا در محاسبه Node برای نماینده', id, err);
      nodeResults[id] = NaN;
    }
  }

  // Python bulk (single call if possible)
  let pythonResults: Record<number, number> = {};
  try {
    const py = await pythonFinancialClient.calculateBulkDebt(ids);
    for (const row of py) {
      pythonResults[row.representative_id] = row.total_debt;
    }
  } catch (err) {
    console.error('خطا در دریافت نتایج Python:', err);
    // Fallback: mark all as NaN
    for (const id of ids) pythonResults[id] = NaN;
  }

  // Build drift rows
  const rows: DriftRow[] = [];
  for (const id of ids) {
    const nodeDebt = nodeResults[id];
    const pyDebt = pythonResults[id];
    if (Number.isNaN(nodeDebt) || Number.isNaN(pyDebt)) continue;
    const diff = Math.abs(nodeDebt - pyDebt);
    const baseline = nodeDebt === 0 ? 1 : nodeDebt; // avoid divide by zero; treat zero baseline carefully
    const ppm = (diff / baseline) * 1_000_000;
    rows.push({ representative_id: id, node_debt: nodeDebt, python_debt: pyDebt, diff, ppm });
  }

  // Metrics
  const representative_count = rows.length;
  const max_diff = rows.reduce((m, r) => r.diff > m ? r.diff : m, 0);
  const max_ppm = rows.reduce((m, r) => r.ppm > m ? r.ppm : m, 0);
  const avg_ppm = representative_count ? rows.reduce((s, r) => s + r.ppm, 0) / representative_count : 0;
  const zero_debt_mismatch_count = rows.filter(r => (r.node_debt === 0 && r.python_debt !== 0) || (r.python_debt === 0 && r.node_debt !== 0)).length;

  // Worst top 5 by ppm
  const worst = [...rows].sort((a, b) => b.ppm - a.ppm).slice(0, 5);
  const sample = rows.slice(0, 5);

  const result: HarnessResult = {
    timestamp: new Date().toISOString(),
    representative_count,
    max_diff: Math.round(max_diff * 100) / 100,
    max_ppm: Math.round(max_ppm),
    avg_ppm: Math.round(avg_ppm),
    zero_debt_mismatch_count,
    worst,
    sample
  };

  const durationMs = Date.now() - start;

  if (json) {
    console.log(JSON.stringify({ duration_ms: durationMs, ...result }, null, 2));
  } else {
    console.log('--- Python vs Node Debt Consistency ---');
    console.log('Duration (ms):', durationMs);
    console.log('Representatives Compared:', representative_count);
    console.log('Max Diff:', result.max_diff);
    console.log('Max PPM:', result.max_ppm);
    console.log('Avg PPM:', result.avg_ppm);
    console.log('Zero Debt Mismatches:', result.zero_debt_mismatch_count);
    console.log('Worst (top 5 by ppm):');
    for (const w of worst) {
      console.log(`  Rep ${w.representative_id}: node=${w.node_debt} python=${w.python_debt} diff=${w.diff} ppm=${Math.round(w.ppm)}`);
    }
  }
}

// Allow import without execution
if (require.main === module) {
  main().catch(err => {
    console.error('Harness execution failed:', err);
    process.exit(1);
  });
}

export { main as runComparisonHarness };