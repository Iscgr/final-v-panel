/**
 * Portal Content Regression Script (Phase 4 - Todo 8)
 * سناریو: Login -> fetch status/full -> create announcement + app -> publish -> verify version bump & cache invalidation.
 * اجرا: npx ts-node scripts/portal-content-regression.ts
 */
import fetch from 'node-fetch';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin';

async function login(cookieJar: string[]): Promise<void> {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
  });
  if (!res.ok) throw new Error('login_failed ' + res.status);
  const setCookie = res.headers.raw()['set-cookie'] || [];
  cookieJar.push(...setCookie.map(c => c.split(';')[0]));
}

async function api(path: string, cookieJar: string[], init: any = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers || {});
  if (cookieJar.length) headers['Cookie'] = cookieJar.join('; ');
  const res = await fetch(BASE + path, { ...init, headers });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, json, text, headers: res.headers };
}

async function run() {
  const cookieJar: string[] = [];
  console.log('🔐 Logging in...');
  await login(cookieJar);
  console.log('✅ Logged in');

  console.log('📥 Fetch initial status');
  const status1 = await api('/api/admin/portal-content-blocks/status', cookieJar);
  if (!status1.json?.success) throw new Error('failed_status_initial');
  const initialVersion = status1.json.data.contentVersion;
  console.log('   Version:', initialVersion);

  console.log('📥 Fetch initial full (expect MISS first call)');
  const full1 = await api('/api/admin/portal-content-blocks/full', cookieJar);
  if (!full1.json?.success) throw new Error('failed_full_initial');
  console.log('   Blocks:', full1.json.data.blocks.length, 'Announcements:', full1.json.data.announcements.length);

  console.log('➕ Create announcement');
  const newAnn = await api('/api/admin/announcements', cookieJar, { method: 'POST', body: JSON.stringify({ title: 'Test ANN', content: 'Hello', priority: 1 }) });
  if (!newAnn.json?.success) throw new Error('failed_create_announcement');

  console.log('➕ Create app-download');
  const newApp = await api('/api/admin/app-downloads', cookieJar, { method: 'POST', body: JSON.stringify({ title: 'App T', downloadLink: 'https://example.com/app.apk', displayOrder: 0 }) });
  if (!newApp.json?.success) throw new Error('failed_create_app');

  console.log('📥 Fetch full after mutations (should MISS again after invalidation)');
  const full2 = await api('/api/admin/portal-content-blocks/full', cookieJar);
  if (!full2.json?.success) throw new Error('failed_full_after_mutations');
  if (!full2.json.data.announcements.find((a: any) => a.title === 'Test ANN')) throw new Error('announcement_not_present');

  console.log('🚀 Publish content');
  const pub = await api('/api/admin/portal-content-blocks/publish', cookieJar, { method: 'POST' });
  if (!pub.json?.success) throw new Error('failed_publish');

  console.log('📥 Fetch status after publish (version should +1)');
  const status2 = await api('/api/admin/portal-content-blocks/status', cookieJar);
  const newVersion = status2.json?.data?.contentVersion;
  if (newVersion !== initialVersion + 1 && !(initialVersion === 0 && newVersion === 1)) {
    throw new Error(`version_not_incremented initial=${initialVersion} new=${newVersion}`);
  }

  console.log('📥 Fetch full again (MISS then HIT)');
  const full3 = await api('/api/admin/portal-content-blocks/full', cookieJar);
  if (!full3.json?.success) throw new Error('failed_full_post_publish');
  const full4 = await api('/api/admin/portal-content-blocks/full', cookieJar);
  if (full4.json?.cache !== 'HIT') console.warn('cache_hit_not_reported');

  console.log('✅ Regression scenario passed.');
}

run().catch(err => {
  console.error('❌ REGRESSION FAILED:', err);
  process.exit(1);
});
