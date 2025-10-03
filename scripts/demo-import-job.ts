#!/usr/bin/env ts-node
/**
 * اسکریپت دمو برای ایجاد و شبیه‌سازی پیشرفت یک import job
 */
import fetch from 'node-fetch';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const COOKIE = process.env.ADMIN_COOKIE || '';

function headers() {
  return COOKIE ? { 'Cookie': COOKIE, 'Content-Type':'application/json' } : { 'Content-Type':'application/json' };
}

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

async function run() {
  const jobCode = 'DEMO_JOB_' + Date.now();
  console.log('Creating job', jobCode);
  let res = await fetch(BASE + '/api/admin/import-jobs', { method:'POST', headers: headers(), body: JSON.stringify({ jobCode, sourceFileName:'demo.json', totalRecords: 120 })});
  console.log('Create status', res.status);

  const steps: { status:string; processed:number }[] = [
    { status:'validating', processed: 0 },
    { status:'ingesting', processed: 40 },
    { status:'ingesting', processed: 80 },
    { status:'enriching', processed: 110 },
    { status:'completed', processed: 120 }
  ];

  for (const step of steps) {
    await sleep(1200);
    console.log('Updating', step.status, step.processed);
    await fetch(BASE + '/api/admin/import-jobs/' + jobCode, { method:'PATCH', headers: headers(), body: JSON.stringify({ status: step.status, processedRecords: step.processed })});
  }
  console.log('Done. View in /admin/import-jobs');
}

run().catch(e => { console.error(e); process.exit(1); });
