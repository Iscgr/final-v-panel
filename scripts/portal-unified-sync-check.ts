#!/usr/bin/env ts-node
/**
 * اسکریپت همگرایی محتوای پرتال
 * - دریافت published unified سند (admin endpoint)
 * - دریافت public resources (endpoint عمومی)
 * - مقایسه مجموعه downloads و announcements فعال
 * خروجی: گزارش تفاوت‌ها + exit code 0 اگر sync یا flag!=full، 1 اگر mismatch در حالت full.
 */
import fetch from 'node-fetch';

interface UnifiedDoc { downloads:any[]; announcements:any[]; sections:any[]; }

async function main() {
  const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
  const cookie = process.env.ADMIN_COOKIE; // لازم برای draft/status (سشن ادمین)

  // 1. وضعیت flag
  const flagRes = await fetch(base + '/api/admin/portal-content-flag/state', { headers: cookie? { Cookie: cookie }: undefined });
  const flagJson: any = await flagRes.json().catch(()=>({}));
  const flagState: string = flagJson && flagJson.data && flagJson.data.state ? flagJson.data.state : 'off';
  console.log('flagState=', flagState);

  // 2. دریافت سند published (از همان endpoint draft envelope ولی publishedVersion)
  const draftRes = await fetch(base + '/api/admin/portal-content-unified/draft', { headers: cookie? { Cookie: cookie }: undefined });
  const draftJson: any = await draftRes.json().catch(()=>({}));
  const publishedVersion: number = draftJson?.data?.publishedVersion || 0;
  const draftVersion: number = draftJson?.data?.draftVersion || 0;
  const unifiedDraft: UnifiedDoc | undefined = draftJson?.data?.draftJson;
  console.log('draftVersion=', draftVersion, 'publishedVersion=', publishedVersion);

  // فرض: publishedJson محتوی همان ساختار است ولی فقط از مسیر public قابل دیدن (در حالت full)
  // 3. دریافت public resources
  const publicId = process.env.TEST_PUBLIC_ID || 'demo';
  const pubRes = await fetch(base + `/api/portal/${publicId}/resources`);
  const pubJson: any = await pubRes.json().catch(()=>({}));

  const source: string | undefined = pubJson?.data?.source;
  console.log('public source=', source);

  if (flagState !== 'full') {
    console.log('⚠ Flag full نیست؛ sync check را Skipped در نظر می‌گیریم.');
    process.exit(0);
  }

  if (source !== 'unified') {
    console.error('❌ انتظار unified public ولی دریافت legacy');
    process.exit(1);
  }

  const unifiedPublished: UnifiedDoc | undefined = pubJson?.data?.unified;
  if (!unifiedPublished) {
    console.error('❌ unifiedPublished در پاسخ public وجود ندارد');
    process.exit(1);
  }

  // 4. استخراج مجموعه شناسه یا عنوان برای مقایسه
  const activeDraftDownloads = (unifiedDraft?.downloads||[]).filter(d=> d.isActive !== false).map(d=> d.title).sort();
  const activePublishedDownloads = (unifiedPublished.downloads||[]).filter((d:any)=> d.isActive !== false).map((d:any)=> d.title).sort();

  const activeDraftAnnouncements = (unifiedDraft?.announcements||[]).filter(a=> a.isActive !== false).map(a=> a.title).sort();
  const activePublishedAnnouncements = (unifiedPublished.announcements||[]).filter((a:any)=> a.isActive !== false).map((a:any)=> a.title).sort();

  const diff = (a:string[], b:string[]) => ({ missing: a.filter(x=> !b.includes(x)), extra: b.filter(x=> !a.includes(x)) });

  const downloadsDiff = diff(activeDraftDownloads, activePublishedDownloads);
  const announcementsDiff = diff(activeDraftAnnouncements, activePublishedAnnouncements);

  const hasMismatch = downloadsDiff.missing.length || downloadsDiff.extra.length || announcementsDiff.missing.length || announcementsDiff.extra.length;

  if (hasMismatch) {
    console.error('❌ MISMATCH DETECTED');
    console.error('downloadsDiff=', downloadsDiff);
    console.error('announcementsDiff=', announcementsDiff);
    process.exit(1);
  }

  console.log('✅ Unified published public view با draft فعال (برای موارد فعال) همگراست.');
  process.exit(0);
}

main().catch(e => { console.error('Script error', e); process.exit(1); });
