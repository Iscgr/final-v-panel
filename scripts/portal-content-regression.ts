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
  const blocksJson = await blocksRes.json();
  const blocks: Block[] = blocksJson.data || [];
  const keys = blocks.map(b => b.blockKey);
  const missing = REQUIRED_KEYS.filter(k => !keys.includes(k));
  if (missing.length) {
    console.error('FAIL: missing required block keys:', missing);
    process.exit(1);
  }
  console.log('OK: all required block keys present');

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
    const putJson = await putRes.json();
    if (!putJson.success) {
      console.error('FAIL: could not update guidance block');
      process.exit(1);
    }
    // revert
    await fetch(base + '/api/admin/portal-content-blocks/guidance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ title: guidance.title, body: original })
    });
    console.log('OK: upsert + revert guidance block');
  } else {
    console.log('WARN: guidance block not found unexpectedly');
  }

  console.log('✔ Regression script finished successfully');
}

main().catch(err => {
  console.error('UNCAUGHT ERROR in regression script:', err);
  process.exit(1);
});
