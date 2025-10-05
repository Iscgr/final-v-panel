import { strict as assert } from 'assert';
import { db } from '../db.js';
import { salesPartners, partnerCommissionPayments } from '../../shared/schema.js';
import { storage } from '../storage.js';
import { sql, eq } from 'drizzle-orm';

/**
 * تست‌های تسویه جزئی پرداخت پورسانت (Phase 2 – Partial Settlement)
 * سناریوها:
 * 1) ایجاد همکار و پرداخت پایه در وضعیت pending
 * 2) انجام تسویه جزئی معتبر (کاهش مانده)
 * 3) چند تسویه جزئی متوالی و بررسی تجمعی بودن settledAmount
 * 4) جلوگیری از over-settle (بیشتر از مانده)
 * 5) تسویه نهایی = auto-close به paid و remaining صفر
 */

async function createPartner(name: string, commissionRate = '5') {
  const [p] = await db.insert(salesPartners).values({ name, commissionRate, isActive: true }).returning();
  return p;
}

async function createPayment(partnerId: number, amount: string) {
  const [pay] = await db.insert(partnerCommissionPayments).values({
    salesPartnerId: partnerId,
    amount,
    note: 'INIT',
    status: 'pending'
  }).returning();
  return pay;
}

(async () => {
  console.log('PHASE2-PARTIAL-SETTLEMENT: starting commission-partial-settlement.spec.ts');

  // تمیزکاری حداقلی جدول‌های درگیر (صرفاً پرداخت‌های تستی با status pending و note INIT)
  await db.execute(sql`DELETE FROM partner_commission_payments WHERE note = 'INIT';`);

  // 1) ایجاد همکار و پرداخت پایه
  const partner = await createPartner('Test Partner PartialSettle');
  assert.ok(partner.id > 0, 'partner created');

  const payment = await createPayment(partner.id, '1000.00');
  assert.equal(payment.status, 'pending');
  assert.equal(payment.amount, '1000.00');

  // 2) تسویه جزئی اول: 200
  const r1 = await storage.applyPartialSettlement(payment.id, 200, 'first part', 'tester');
  assert.equal(Number((r1 as any).settledAmount), 200, 'settledAmount پس از اولین تسویه باید 200 باشد');
  assert.equal(r1.remaining, 800, 'remaining باید 800 باشد');
  assert.equal((r1 as any).status, 'pending', 'هنوز باید pending باشد');

  // 3) تسویه جزئی دوم: 500 (تجمیعی 700)
  const r2 = await storage.applyPartialSettlement(payment.id, 500, 'second part', 'tester');
  assert.equal(Number((r2 as any).settledAmount), 700, 'settledAmount تجمیعی باید 700 باشد');
  assert.equal(r2.remaining, 300, 'remaining باید 300 باشد');
  assert.equal((r2 as any).status, 'pending', 'هنوز pending');

  // 4) جلوگیری از over-settle (تلاش برای 400 در حالی که 300 مانده است)
  let overError: any = null;
  try {
    await storage.applyPartialSettlement(payment.id, 400, 'should-fail', 'tester');
  } catch (e: any) {
    overError = e;
  }
  assert.ok(overError, 'باید خطا پرتاب شود برای over-settle');
  assert.match(overError.message, /بیشتر است|بیشتر/);

  // 5) تسویه نهایی: 300 => remaining صفر و وضعیت paid
  const r3 = await storage.applyPartialSettlement(payment.id, 300, 'final part', 'tester');
  assert.equal(Number((r3 as any).settledAmount), 1000, 'settledAmount نهایی 1000');
  assert.equal(r3.remaining, 0, 'remaining صفر');
  assert.equal((r3 as any).status, 'paid', 'auto-close به paid');

  // تایید ذخیره در DB
  const [row] = await db.select().from(partnerCommissionPayments).where(eq(partnerCommissionPayments.id, payment.id)).limit(1);
  assert.equal((row as any).status, 'paid');
  assert.equal(Number((row as any).settledAmount), 1000);

  console.log('commission-partial-settlement.spec.ts PASS');
  process.exit(0);
})().catch(err => {
  console.error('commission-partial-settlement.spec.ts FAIL', err);
  process.exit(1);
});
