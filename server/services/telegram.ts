export interface TelegramMessage {
  representativeName: string;
  shopOwner: string | null;
  panelId: string;
  amount: string;
  issueDate: string;
  status: string;
  portalLink: string;
  invoiceNumber: string;
  isResend?: boolean;
  sendCount?: number;
}

// --- E-C1 Shadow Integration Imports ---
import { featureFlagManager } from './feature-flag-manager.js';
import { OutboxService } from './outbox.js';

let sharedOutboxService: OutboxService | null = null;
function getOutboxService(): OutboxService {
  if (!sharedOutboxService) {
    sharedOutboxService = new OutboxService();
  }
  return sharedOutboxService;
}

export async function sendInvoiceToTelegram(
  botToken: string,
  chatId: string,
  message: TelegramMessage,
  template: string
): Promise<boolean> {
  try {
    const outboxState = featureFlagManager.getMultiStageFlagState('outbox_enabled');
    // Determine resend indicator
    const resendIndicator = message.isResend 
      ? ` (ارسال مجدد - ${message.sendCount || 1})` 
      : '';
    
    // ✅ SHERLOCK v32.0: Ensure production portal link generation
    const productionPortalLink = message.portalLink.includes('localhost') || message.portalLink.includes('127.0.0.1')
      ? message.portalLink.replace(/localhost:\d+|127\.0\.0\.1:\d+/, process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'your-production-domain.com')
      : message.portalLink;
    
    console.log(`🔗 SHERLOCK v32.0: Portal link generation - Original: ${message.portalLink}, Production: ${productionPortalLink}`);
    
    // Replace template variables with actual data
    let messageText = template
      .replace(/{representative_name}/g, message.representativeName)
      .replace(/{shop_owner}/g, message.shopOwner || 'نامشخص')
      .replace(/{panel_id}/g, message.panelId)
      .replace(/{amount}/g, message.amount)
      .replace(/{issue_date}/g, message.issueDate)
      .replace(/{status}/g, message.status)
      .replace(/{portal_link}/g, productionPortalLink)
      .replace(/{invoice_number}/g, message.invoiceNumber)
      .replace(/{resend_indicator}/g, resendIndicator);

    // --- Phase C Shadow Mode: enqueue instead of direct send when flag ON ---
    if (outboxState === 'on') {
      try {
        const outboxService = getOutboxService();
        await outboxService.enqueueMessage({
          type: 'TELEGRAM_MESSAGE',
            payload: {
              recipient: chatId,
              message: messageText,
              options: { parse_mode: 'HTML', disable_web_page_preview: true, botToken }
            }
        });
        console.log(`📨 E-C1: Enqueued telegram message for invoice ${message.invoiceNumber} (shadow outbox)`);
        return true; // Enqueue success considered success in shadow
      } catch (enqueueErr) {
        console.warn('⚠️ E-C1: Enqueue failed, falling back to direct send', enqueueErr);
        // fallback to direct send below
      }
    }

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const result = await response.json();
    return result.ok === true;
  } catch (error) {
    console.error('خطا در ارسال پیام تلگرام:', error);
    return false;
  }
}

export async function sendBulkInvoicesToTelegram(
  botToken: string,
  chatId: string,
  messages: TelegramMessage[],
  template: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const message of messages) {
    const sent = await sendInvoiceToTelegram(botToken, chatId, message, template);
    if (sent) {
      success++;
      // Add delay to avoid rate limiting (only when direct send path; enqueue path does not need delay)
      const outboxState = featureFlagManager.getMultiStageFlagState('outbox_enabled');
      if (outboxState !== 'on') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      failed++;
    }
  }

  return { success, failed };
}

export function getDefaultTelegramTemplate(): string {
  return `📋 فاکتور شماره {invoice_number}{resend_indicator}

🏪 نماینده: {representative_name}
👤 صاحب فروشگاه: {shop_owner}
📱 شناسه پنل: {panel_id}
💰 مبلغ فاکتور: {amount} تومان
📅 تاریخ صدور: {issue_date}
🔍 وضعیت: {status}

ℹ️ برای مشاهده جزئیات کامل فاکتور، وارد لینک زیر بشوید

{portal_link}

تولید شده توسط سیستم مدیریت مالی 🤖`;
}

export function formatInvoiceStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'unpaid': 'پرداخت نشده ❌',
    'paid': 'پرداخت شده ✅', 
    'overdue': 'سررسید گذشته ⚠️',
    'partial': 'پرداخت جزئی 🔶'
  };
  
  return statusMap[status] || 'نامشخص';
}
