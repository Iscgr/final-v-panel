#!/usr/bin/env tsx
/**
 * ingest-real-sample.ts
 * هدف: استفاده از فایل واقعی a.json برای پر کردن جداول representatives, invoices, payments
 * بدون تولید داده مصنوعی. ساختار فایل a.json (بر اساس نمونه) شامل آرایه data با رکوردهایی است
 * که دارای فیلد amount می‌باشند. در نبود سایر فیلدها، مقادیر ساختگی حداقلی اما پایدار (deterministic)
 * بر مبنای index تولید می‌شود تا Traceability حفظ گردد.
 *
 * Modes:
 *  --dry-run  فقط محاسبه متریک (count, sum) و عدم درج.
 *  --apply    درج واقعی (skip اگر قبلا بر اساس hash شناسه تولید شده وجود داشته باشد).
 *
 * Strategy:
 *  - ایجاد یا یافتن representative پویا بر اساس admin_username (panelUsername) هر گروه متوالی.
 *  - گروه‌بندی contiguous: تا زمانی که admin_username تغییر نکرده، خطوط در یک گروه جمع می‌شوند.
 *  - برای هر گروه یک invoice با amount = Σ amounts و یک payment متناظر ایجاد می‌شود.
 *  - خطوط خام به جدول invoice_usage_items درج می‌گردند برای Traceability و نمایش جزئیات.
 *  - amount در invoice.amount به DECIMAL (ثبت به صورت text سپس CAST توسط drizzle) و در payment.amount همچنان TEXT (shadow column amount_dec برای فاز CAST).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
// توجه: برای حالت تست بدون پایگاه داده (مثلاً CI خشکتر یا بدون تنظیم DATABASE_URL)،
// اگر فقط --dry-run باشد و DATABASE_URL تنظیم نشده باشد ما درج به DB را Skip می‌کنیم.
// برای این منظور به صورت پویا تلاش می‌کنیم ماژول پایگاه داده را import کنیم و اگر شکست خورد
// در حالت dry-run ادامه می‌دهیم. در حالت apply همچنان خطا می‌دهیم.
let db: any = null;
let dbAvailable = false;
try {
  // dynamic import جهت جلوگیری از خطای Early Throw در database-manager
  if (process.env.DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../server/database-manager.js');
    db = mod.db;
    dbAvailable = true;
  }
} catch (e) {
  dbAvailable = false;
}
import { representatives, invoices, payments, invoiceUsageItems } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface SampleRecord { [k: string]: any; amount?: string | number; }
type ParsedRoot = any;

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    apply: args.includes('--apply'),
    progress: args.includes('--progress'), // فعال کردن خروجی پیشرفت (NDJSON)
    limit: (() => { const i = args.indexOf('--limit'); return i >= 0 ? Number(args[i + 1]) : undefined; })()
  } as const;
}

// رویدادهای پیشرفت برای مصرف توسط ابزارهای بیرونی (Stream / NDJSON)
type ProgressEvent =
  | { seq: number; type: 'init'; timestamp: string; totalRecords: number; detectedGroups: number; mode: string; limit?: number }
  | { seq: number; type: 'group_start'; timestamp: string; groupIndex: number; adminUsername: string; lineCount: number; sum: number; startIndex: number; endIndex: number }
  | { seq: number; type: 'group_skip'; timestamp: string; groupIndex: number; invoiceNumber: string; reason: string }
  | { seq: number; type: 'group_applied'; timestamp: string; groupIndex: number; invoiceNumber: string; paymentDesc: string; invoiceId?: number; linesInserted: number }
  | { seq: number; type: 'complete'; timestamp: string; summary: any };

let __seq = 0;
function nextSeq() { return ++__seq; }
function emit(progressEnabled: boolean, ev: ProgressEvent) {
  if (!progressEnabled) return;
  // تک‌خطی برای قابلیت پردازش استریم
  process.stdout.write(JSON.stringify(ev) + '\n');
}

async function ensureRepresentativeDynamic(adminUsername: string) {
  // code و publicId را بر اساس adminUsername می‌سازیم (Upper-safe)
  const code = `REP-${adminUsername.toUpperCase()}`;
  if (!dbAvailable) return -1; // placeholder id در حالت dry-run بدون DB
  const existing = await db.query.representatives.findFirst({ where: eq(representatives.panelUsername, adminUsername) });
  if (existing) return existing.id;
  const inserted = await db.insert(representatives).values({
    code,
    name: `Representative ${adminUsername}`,
    ownerName: adminUsername,
    panelUsername: adminUsername,
    publicId: `pub_${adminUsername}`
  }).returning({ id: representatives.id });
  return inserted[0].id;
}

function stableIds(index: number) {
  // بر اساس index هش می‌سازیم تا در اجرای مجدد idempotent باشد (با unique constraints طبیعی ممکن است skip شود)
  // چون از serial استفاده می‌کنیم، id را کنترل نمی‌کنیم. اما برای جلوگیری از درج تکراری، از invoice_number و payment.description hash استفاده می‌کنیم.
  const hash = crypto.createHash('sha1').update('INGEST-'+index).digest('hex').slice(0,12).toUpperCase();
  return { invoiceNumber: `INV-ING-${hash}`, paymentDesc: `PAY-ING-${hash}` };
}

async function invoiceExists(invoiceNumber: string) {
  if (!dbAvailable) return false; // در حالت dry-run بدون DB
  const existing = await db.query.invoices.findFirst({ where: eq(invoices.invoiceNumber, invoiceNumber) });
  return !!existing;
}

async function main() {
  const { dryRun, apply, progress, limit } = parseArgs();
  if (!dryRun && !apply) {
    console.error('Specify one of --dry-run or --apply');
    process.exit(1);
  }
  const filePath = path.resolve(process.cwd(), 'a.json');
  if (!fs.existsSync(filePath)) {
    console.error('a.json file not found in workspace root');
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath,'utf8');
  let parsed: ParsedRoot;
  try { parsed = JSON.parse(raw); } catch { console.error('Invalid JSON format in a.json'); process.exit(1); }
  // ساختار: آرایه‌ای از بلاک‌ها؛ یکی از بلاک‌ها type=table و فیلد data آرایه رکوردها
  let records: SampleRecord[] = [];
  if (Array.isArray(parsed)) {
    for (const block of parsed) {
      if (block && block.type === 'table' && Array.isArray(block.data)) {
        records = block.data;
        break;
      }
    }
  }
  const slice = typeof limit==='number' ? records.slice(0, limit) : records;

  interface Group { adminUsername: string; startIndex: number; endIndex: number; lines: SampleRecord[]; sum: number; }
  const groups: Group[] = [];
  let current: Group | null = null;
  for (let i=0;i<slice.length;i++) {
    const r = slice[i];
    const adminUsername = r.admin_username || r.adminUsername;
    if (!adminUsername) continue; // خط بدون admin_username نادیده گرفته می‌شود
    const amountRaw = r.amount;
    const num = amountRaw == null ? NaN : (typeof amountRaw === 'number' ? amountRaw : Number(String(amountRaw).replace(/[^0-9.\-]/g,'')));
    if (!current || current.adminUsername !== adminUsername) {
      if (current) groups.push(current);
      current = { adminUsername, startIndex: i, endIndex: i, lines: [], sum: 0 };
    }
    current.lines.push(r);
    current.endIndex = i;
    if (!Number.isNaN(num)) current.sum += num;
  }
  if (current) groups.push(current);

  // ترتیب قطعی گروه‌ها بر اساس startIndex (اینجا معمولا همان ساخت اولیه است ولی برای اطمینان sort می‌کنیم)
  groups.sort((a,b)=>a.startIndex - b.startIndex);

  emit(progress, { seq: nextSeq(), type: 'init', timestamp: new Date().toISOString(), totalRecords: records.length, detectedGroups: groups.length, mode: dryRun? 'DRY_RUN':'APPLY', limit });

  let totalLines = 0; let totalAmount = 0; let invoicesCreated = 0; let paymentsCreated = 0; let usageItemsInserted = 0; let skippedInvoices = 0;
  for (let gIndex=0; gIndex<groups.length; gIndex++) {
    const g = groups[gIndex];
    totalLines += g.lines.length; totalAmount += g.sum;
    const { invoiceNumber, paymentDesc } = stableIds(g.startIndex);
    emit(progress, { seq: nextSeq(), type: 'group_start', timestamp: new Date().toISOString(), groupIndex: gIndex, adminUsername: g.adminUsername, lineCount: g.lines.length, sum: Number(g.sum.toFixed(2)), startIndex: g.startIndex, endIndex: g.endIndex });
    if (apply) {
      const exists = await invoiceExists(invoiceNumber);
      if (exists) {
        skippedInvoices++;
        emit(progress, { seq: nextSeq(), type: 'group_skip', timestamp: new Date().toISOString(), groupIndex: gIndex, invoiceNumber, reason: 'invoice_exists' });
        continue;
      }
      if (!dbAvailable) {
        throw new Error('DATABASE_URL missing (db unavailable). Cannot apply ingestion. Set DATABASE_URL env.');
      }
      const repId = await ensureRepresentativeDynamic(g.adminUsername);
      const issueDate = '1404/06/01';
      const paymentDate = '1404/06/02';
  const inv = await db.insert(invoices).values({ invoiceNumber, representativeId: repId, amount: String(g.sum.toFixed(2)), issueDate, status: 'unpaid' }).returning({ id: invoices.id });
      const invoiceId = inv[0].id; invoicesCreated++;
      await db.insert(payments).values({ representativeId: repId, invoiceId, amount: g.sum.toFixed(2), paymentDate, description: paymentDesc, isAllocated: false });
      paymentsCreated++;
      // Insert usage line items (synchronous sequential برای تضمین ترتیب)
      for (const line of g.lines) {
        const amountLineRaw = line.amount;
        const numLine = amountLineRaw == null ? NaN : (typeof amountLineRaw === 'number' ? amountLineRaw : Number(String(amountLineRaw).replace(/[^0-9.\-]/g,'')));
  await db.insert(invoiceUsageItems).values({
          invoiceId,
          adminUsername: g.adminUsername,
          eventTimestamp: line.event_timestamp || line.eventTimestamp || '',
          eventType: line.event_type || line.eventType || 'UNKNOWN',
          description: line.description || null,
          amountText: amountLineRaw != null ? String(amountLineRaw) : '0',
          amountDec: Number.isNaN(numLine) ? null : String(numLine.toFixed(2)),
          rawJson: line
        });
        usageItemsInserted++;
      }
      emit(progress, { seq: nextSeq(), type: 'group_applied', timestamp: new Date().toISOString(), groupIndex: gIndex, invoiceNumber, paymentDesc, invoiceId, linesInserted: g.lines.length });
    }
  }

  const report = {
    mode: dryRun? 'DRY_RUN':'APPLY',
    totalBlocks: records.length,
    groups: groups.length,
    totalLines,
    totalAmount: Number(totalAmount.toFixed(2)),
    invoicesCreated,
    paymentsCreated,
    usageItemsInserted,
    skippedInvoices
  };

  emit(progress, { seq: nextSeq(), type: 'complete', timestamp: new Date().toISOString(), summary: report });
  // حفظ رفتار قبلی برای سازگاری: چاپ خلاصه نهایی (multi-line فقط زمانی که progress غیرفعال است)
  if (progress) {
    console.log(JSON.stringify(report));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
