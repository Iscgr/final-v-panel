#!/usr/bin/env ts-node
/**
 * Unified Portal Content Health Check Script
 * اهداف:
 *  - بررسی در دسترس بودن API های ادمین unified (draft/status)
 *  - بررسی صحت ساختار JSON سند منتشر شده (در صورت وجود)
 *  - بررسی endpoint عمومی و تعیین منبع (unified یا legacy)
 *  - خروج با کد !=0 اگر مشکل بحرانی تشخیص داده شد
 */

import fetch from 'node-fetch';

interface AdminDraftResp { success:boolean; data?:{ draftJson:any; draftVersion:number; publishedVersion:number; status:string }; }
interface AdminStatusResp { success:boolean; data?:{ draftVersion:number; publishedVersion:number; status:string }; }
interface PublicUnifiedResp { success:boolean; data?:{ unified?:any; source:string; appDownloads?:any[]; announcements?:any[] } }

const ADMIN_BASE = process.env.ADMIN_BASE || 'http://localhost:3000/api/admin/portal-content/unified';
const PUBLIC_BASE = process.env.PUBLIC_BASE || 'http://localhost:3000/api/portal';
const SAMPLE_PUBLIC_ID = process.env.PUBLIC_ID || 'sample'; // در محیط واقعی مقدار معتبر بدهید

function fail(msg:string):never { console.error('\u274c', msg); process.exit(1); }
function warn(msg:string){ console.warn('\u26a0\ufe0f', msg); }
function ok(msg:string){ console.log('\u2705', msg); }

async function getJSON<T=any>(url:string):Promise<T>{
  const res = await fetch(url, { headers:{ 'Accept':'application/json' } });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function validateUnifiedStructure(doc:any){
  if(typeof doc !== 'object' || !doc) return 'document_not_object';
  if(!Array.isArray(doc.sections) || !Array.isArray(doc.announcements) || !Array.isArray(doc.downloads)) return 'lists_missing';
  if(typeof doc.displayTitle !== 'string') return 'missing_displayTitle';
  return null;
}

(async ()=> {
  try {
    console.log('=== Unified Portal Health Check ===');

    // 1. Draft
    let draft: AdminDraftResp | null = null;
    try {
      draft = await getJSON<AdminDraftResp>(`${ADMIN_BASE}/draft`);
      if(!draft.success) warn('draft.success = false'); else ok('Draft endpoint OK');
    } catch(e:any){ warn(`Draft endpoint error: ${e.message}`); }

    // 2. Status
    let status: AdminStatusResp | null = null;
    try {
      status = await getJSON<AdminStatusResp>(`${ADMIN_BASE}/status`);
      if(!status.success) warn('status.success = false'); else ok('Status endpoint OK');
    } catch(e:any){ warn(`Status endpoint error: ${e.message}`); }

    // 3. Public resources
    let pub: PublicUnifiedResp | null = null;
    try {
      pub = await getJSON<PublicUnifiedResp>(`${PUBLIC_BASE}/${SAMPLE_PUBLIC_ID}/resources`);
      if(!pub.success) warn('public.success = false'); else ok('Public resources endpoint OK');
    } catch(e:any){ fail(`Public resources unreachable: ${e.message}`); }

    if(pub?.data?.source === 'unified'){
      console.log('Public source: unified');
      const err = validateUnifiedStructure(pub.data.unified);
      if(err) fail(`Unified structure invalid: ${err}`); else ok('Unified published structure valid');
    } else {
      console.log('Public source: legacy (fallback)');
      if(!Array.isArray(pub?.data?.appDownloads) || !Array.isArray(pub?.data?.announcements)) warn('Legacy arrays missing');
    }

    // 4. Sanity of versions
    if(status?.data){
      if(status.data.publishedVersion > status.data.draftVersion) warn('publishedVersion > draftVersion (unexpected)');
      else ok(`Versions draft=${status.data.draftVersion} published=${status.data.publishedVersion}`);
    }

    console.log('Health check completed.');
  } catch(err:any){
    fail(`Fatal error: ${err.message}`);
  }
})();
