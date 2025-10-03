#!/usr/bin/env tsx
/**
 * اسکریپت تست ارسال فاکتور به تلگرام
 * 
 * این اسکریپت یک پیام تستی را با تمام متغیرها به تلگرام ارسال می‌کند.
 */

export {}; // Make this file a module

const BOT_TOKEN = '7974921276:AAEAOu_A6eEeNcnenBvF4Nq10oW8AZRlruM';
const CHAT_ID = '1264791863';

const template = `📋 فاکتور شماره {invoice_number}

🏪 نماینده: {representative_name}
👤 صاحب فروشگاه: {shop_owner}
📱 شناسه پنل: {panel_id}
💰 مبلغ فاکتور: {amount} تومان
📅 تاریخ صدور: {issue_date}
🔍 وضعیت: {status}

ℹ️ برای مشاهده جزئیات کامل فاکتور، وارد لینک زیر بشوید

{portal_link}

تولید شده توسط سیستم مدیریت مالی 🤖`;

const testMessage = {
  invoice_number: 'INV-TEST-001',
  representative_name: 'نماینده تستی',
  shop_owner: 'صاحب فروشگاه تستی',
  panel_id: 'test-panel-123',
  amount: '1,000,000',
  issue_date: '1404/07/11',
  status: 'پرداخت نشده ❌',
  portal_link: 'https://example.com/portal/test-public-id'
};

// Replace template variables
let messageText = template
  .replace(/{invoice_number}/g, testMessage.invoice_number)
  .replace(/{representative_name}/g, testMessage.representative_name)
  .replace(/{shop_owner}/g, testMessage.shop_owner)
  .replace(/{panel_id}/g, testMessage.panel_id)
  .replace(/{amount}/g, testMessage.amount)
  .replace(/{issue_date}/g, testMessage.issue_date)
  .replace(/{status}/g, testMessage.status)
  .replace(/{portal_link}/g, testMessage.portal_link);

console.log('🧪 شروع تست ارسال فاکتور به تلگرام...\n');
console.log('📋 اطلاعات فاکتور تستی:');
console.log(JSON.stringify(testMessage, null, 2));
console.log('\n📄 پیام نهایی که ارسال می‌شود:');
console.log('-----------------------------------');
console.log(messageText);
console.log('-----------------------------------');
console.log('\n🔄 در حال ارسال به تلگرام...\n');

try {
  const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  const response = await fetch(telegramApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: messageText,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  const result = await response.json();
  
  if (result.ok === true) {
    console.log('✅ پیام با موفقیت به تلگرام ارسال شد!');
    console.log('📱 Message ID:', result.result.message_id);
    console.log('\n🔍 لطفاً تلگرام خود را چک کنید و تأیید کنید که:');
    console.log('  1. پیام دریافت شده است');
    console.log('  2. تمام متغیرها به درستی جایگزین شده‌اند');
    console.log('  3. فرمت پیام مطابق الگوی تعریف شده است');
    process.exit(0);
  } else {
    console.error('❌ خطا در ارسال پیام!');
    console.error('کد خطا:', result.error_code);
    console.error('توضیحات:', result.description);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ خطای غیرمنتظره:', error);
  process.exit(1);
}
