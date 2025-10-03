#!/usr/bin/env ts-node
/**
 * Regression Smoke Script for Portal Content Phase 1
 * اهداف:
 * 1. تایید عدم تغییر خروجی منابع عمومی (/api/portal/resources یا مشابه فعلی)
 * 2. تایید اینکه همه کلیدهای استاندارد portal-content-blocks قابل دسترس‌اند
 * 3. انجام یک upsert آزمایشی و برگشت به مقدار قبلی
 */
import fetch from 'node-fetch';

interface Block { blockKey: string; title: string; body: string; }
import crypto from 'crypto';

const REQUIRED_KEYS = [
  'guidance','contact_info','downloads_intro','support_hours','announcements_title'
];

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const adminCookie = process.env.ADMIN_COOKIE; // نیاز به سشن معتبر اگر auth فعال است

  function authHeaders(): Record<string,string> {
    return adminCookie ? { 'Cookie': adminCookie } : {};
  }

  // 1. Fetch portal public (best-effort) - tolerant if 404
  try {
    const portalRes = await fetch(base + '/api/portal/resources');
    if (!portalRes.ok) {
      console.log('WARN: /api/portal/resources status =', portalRes.status);
    } else {
      const json = await portalRes.json();
      console.log('Public resources keys:', Object.keys(json));
    }
  } catch (e) {
    console.log('WARN: Could not fetch /api/portal/resources', (e as Error).message);
  }

  // 2. Fetch admin portal content blocks
  const blocksRes = await fetch(base + '/api/admin/portal-content-blocks', { headers: { ...authHeaders() }});
  if (!blocksRes.ok) {
    console.error('FAIL: cannot fetch portal-content-blocks', blocksRes.status);
    process.exit(1);
  }
  // پاسخ انتظار می‌رود شکل { data: Block[] } داشته باشد؛ در صورت تفاوت، ولیدیشن خطا می‌دهد
  const blocksJson: unknown = await blocksRes.json();
  if (typeof blocksJson !== 'object' || blocksJson === null) {
    console.error('FAIL: unexpected JSON shape for portal-content-blocks (not an object)');
    process.exit(1);
  }
  const blocksData = (blocksJson as { data?: unknown }).data;
  if (!Array.isArray(blocksData)) {
    console.error('FAIL: expected data to be an array in portal-content-blocks response');
    process.exit(1);
  }
  const blocks: Block[] = blocksData.map((r:any) => ({
    blockKey: String(r.blockKey),
    title: typeof r.title === 'string' ? r.title : '',
    body: typeof r.body === 'string' ? r.body : ''
  }));
  const keys = blocks.map(b => b.blockKey);
  const missing = REQUIRED_KEYS.filter(k => !keys.includes(k));
  if (missing.length) {
    console.error('FAIL: missing required block keys:', missing);
    process.exit(1);
  }
  console.log('OK: all required block keys present');

  // اعتبارسنجی بدنه و عنوان غیر خالی (Soft Warning) – عدم توقف اسکریپت مگر همه خالی باشند
  const emptyBodies = blocks.filter(b => !b.body || !b.body.trim());
  if (emptyBodies.length) {
    console.log('WARN:', emptyBodies.length,'blocks have empty body:', emptyBodies.map(b=>b.blockKey));
  }

  // 3. Upsert test on guidance (if present)
  const guidance = blocks.find(b => b.blockKey === 'guidance');
  if (guidance) {
    const original = guidance.body;
    const testBody = original + '\n<!-- smoke-test-line -->';
    const putRes = await fetch(base + '/api/admin/portal-content-blocks/guidance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ title: guidance.title, body: testBody })
    });
    const putJson: unknown = await putRes.json();
    const putOk = typeof putJson === 'object' && putJson !== null && (putJson as any).success === true;
    if (!putOk) {
      console.error('FAIL: could not update guidance block (unexpected response shape)');
      process.exit(1);
    }
    // دریافت مجدد جهت تایید persistence
    const afterPutRes = await fetch(base + '/api/admin/portal-content-blocks', { headers: { ...authHeaders() }});
    const afterPutJson: any = await afterPutRes.json();
    const updatedGuidance = (afterPutJson.data || []).find((b:any)=>b.blockKey==='guidance');
    if (!updatedGuidance || !String(updatedGuidance.body).includes('smoke-test-line')) {
      console.error('FAIL: guidance body not updated as expected');
      process.exit(1);
    }

    // revert تغییر موقت
    const revertRes = await fetch(base + '/api/admin/portal-content-blocks/guidance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ title: guidance.title, body: original })
    });
    const revertJson: any = await revertRes.json();
    if (!(revertJson && revertJson.success)) {
      console.error('FAIL: revert guidance block failed');
      process.exit(1);
    }
    // تایید revert
    const afterRevertRes = await fetch(base + '/api/admin/portal-content-blocks', { headers: { ...authHeaders() }});
    const afterRevertJson: any = await afterRevertRes.json();
    const reverted = (afterRevertJson.data || []).find((b:any)=>b.blockKey==='guidance');
    if (!reverted || String(reverted.body).includes('smoke-test-line')) {
      console.error('FAIL: revert did not restore original content');
      process.exit(1);
    }
    console.log('OK: upsert + verify + revert guidance block');
  } else {
    console.log('WARN: guidance block not found unexpectedly');
  }

  // 4. تولید هش برای وضعیت فعلی بلوک‌ها (شتاب مقایسه آینده / baseline drift)
  const hash = crypto.createHash('sha256');
  for (const b of blocks) {
    hash.update(b.blockKey + '::' + b.title + '::' + b.body + '\n');
  }
  const digest = hash.digest('hex');
  console.log('Snapshot SHA256 of blocks state:', digest);

  // 5. (اختیاری) تست round-trip روی اولین بلوک غیر guidance — ایمن؛ اگر ENV فعال شد
  if (process.env.EXTRA_ROUND_TRIP === '1') {
    const target = blocks.find(b=>b.blockKey !== 'guidance');
    if (target) {
      const original = target.body;
      const testBody = original + '\n<!-- extra-round-trip -->';
      const putRes = await fetch(base + `/api/admin/portal-content-blocks/${target.blockKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: target.title, body: testBody })
      });
      const putJson: any = await putRes.json();
      if (!(putJson && putJson.success)) {
        console.error('FAIL: extra round-trip update failed');
        process.exit(1);
      }
      // revert
      await fetch(base + `/api/admin/portal-content-blocks/${target.blockKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: target.title, body: original })
      });
      console.log('OK: extra round-trip test on', target.blockKey);
    }
  }

  console.log('✔ Regression script finished successfully');
}

main().catch(err => {
  console.error('UNCAUGHT ERROR in regression script:', err);
  process.exit(1);
});
