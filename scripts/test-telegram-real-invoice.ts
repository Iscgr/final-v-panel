#!/usr/bin/env tsx
/**
 * ODIN v5.0 - Complete Invoice Telegram Send Test
 * 
 * این اسکریپت:
 * 1. یک نماینده از دیتابیس می‌خواند
 * 2. یک فاکتور از دیتابیس می‌خواند
 * 3. قالب پیام را از تنظیمات می‌خواند
 * 4. پیام را با تمام متغیرها آماده می‌کند
 * 5. به تلگرام ارسال می‌کند
 */

import { db } from '../server/db.js';
import { representatives, invoices, settings } from '../shared/schema.js';
import { eq, desc } from 'drizzle-orm';
import { sendInvoiceToTelegram, getDefaultTelegramTemplate, type TelegramMessage } from '../server/services/telegram.js';
import { getPortalLink } from '../server/config.js';

console.log('🧪 ODIN v5.0: Testing Complete Invoice Telegram Send Flow\n');

async function testInvoiceSend() {
  try {
    const database = db;
    
    // 1. Get Telegram settings
    console.log('📋 Step 1: Fetching Telegram settings...');
    const [botTokenSetting] = await database.select().from(settings).where(eq(settings.key, 'telegram_bot_token')).limit(1);
    const [chatIdSetting] = await database.select().from(settings).where(eq(settings.key, 'telegram_chat_id')).limit(1);
    const [templateSetting] = await database.select().from(settings).where(eq(settings.key, 'telegram_template')).limit(1);
    
    const botToken = botTokenSetting?.value || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = chatIdSetting?.value || process.env.TELEGRAM_CHAT_ID;
    const template = templateSetting?.value || getDefaultTelegramTemplate();
    
    if (!botToken || !chatId) {
      console.error('❌ Telegram credentials not found in database or environment');
      console.log('Please set telegram_bot_token and telegram_chat_id in settings');
      return;
    }
    
    console.log('✅ Telegram settings loaded');
    console.log(`   Bot Token: ${botToken.substring(0, 10)}...`);
    console.log(`   Chat ID: ${chatId}`);
    console.log(`   Template Length: ${template.length} chars\n`);
    
    // 2. Get first representative
    console.log('📋 Step 2: Fetching a representative...');
    const [representative] = await database.select().from(representatives).limit(1);
    
    if (!representative) {
      console.error('❌ No representatives found in database');
      console.log('Please add a representative first');
      return;
    }
    
    console.log('✅ Representative loaded:');
    console.log(`   ID: ${representative.id}`);
    console.log(`   Name: ${representative.name}`);
    console.log(`   Owner: ${representative.ownerName}`);
    console.log(`   Public ID: ${representative.publicId}\n`);
    
    // 3. Get first unpaid invoice for this representative
    console.log('📋 Step 3: Fetching an invoice...');
    const [invoice] = await database.select()
      .from(invoices)
      .where(eq(invoices.representativeId, representative.id))
      .orderBy(desc(invoices.createdAt))
      .limit(1);
    
    if (!invoice) {
      console.error('❌ No invoices found for this representative');
      console.log('Please add an invoice first');
      return;
    }
    
    console.log('✅ Invoice loaded:');
    console.log(`   ID: ${invoice.id}`);
    console.log(`   Number: ${invoice.invoiceNumber}`);
    console.log(`   Amount: ${invoice.amount}`);
    console.log(`   Status: ${invoice.status}`);
    console.log(`   Issue Date: ${invoice.issueDate}\n`);
    
    // 4. Prepare telegram message
    console.log('📋 Step 4: Preparing Telegram message...');
    
    const portalLink = getPortalLink(representative.publicId);
    const formattedAmount = parseFloat(invoice.amount).toLocaleString('fa-IR', {
      maximumFractionDigits: 0
    });
    
    const telegramMessage: TelegramMessage = {
      invoiceNumber: invoice.invoiceNumber,
      representativeName: representative.name,
      shopOwner: representative.ownerName || representative.name,
      panelId: representative.panelUsername || representative.code,
      amount: formattedAmount,
      issueDate: invoice.issueDate,
      status: invoice.status === 'paid' ? 'پرداخت شده ✅' : 'پرداخت نشده ❌',
      portalLink,
      isResend: invoice.sentToTelegram || false,
      sendCount: (invoice.telegramSendCount || 0) + 1
    };
    
    console.log('✅ Message data prepared:');
    console.log('   Variables:');
    Object.entries(telegramMessage).forEach(([key, value]) => {
      console.log(`     ${key}: ${value}`);
    });
    console.log();
    
    // 5. Send to Telegram
    console.log('📋 Step 5: Sending to Telegram...');
    const success = await sendInvoiceToTelegram(botToken, chatId, telegramMessage, template);
    
    if (success) {
      console.log('✅ Invoice sent successfully to Telegram!');
      console.log('   Check your Telegram chat for the message\n');
      
      // Update invoice status
      console.log('📋 Step 6: Updating invoice status...');
      await database.update(invoices)
        .set({
          sentToTelegram: true,
          telegramSentAt: new Date(),
          telegramSendCount: telegramMessage.sendCount
        })
        .where(eq(invoices.id, invoice.id));
      
      console.log('✅ Invoice status updated in database');
    } else {
      console.error('❌ Failed to send invoice to Telegram');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  }
}

// Run test
testInvoiceSend().then(() => {
  console.log('\n✨ Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
