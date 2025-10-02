/**
 * Interface for Telegram message data
 * 
 * Template Variables Mapping:
 * - {invoice_number} => invoiceNumber
 * - {representative_name} => representativeName
 * - {shop_owner} => shopOwner
 * - {panel_id} => panelId
 * - {amount} => amount (formatted with thousand separators)
 * - {issue_date} => issueDate
 * - {status} => status (formatted with Persian labels)
 * - {portal_link} => portalLink (production URL)
 * - {resend_indicator} => auto-generated based on isResend flag
 */
export interface TelegramMessage {
  /** شماره فاکتور - مستقیماً از invoice.invoiceNumber */
  invoiceNumber: string;
  
  /** نام نماینده - از representative.name */
  representativeName: string;
  
  /** نام صاحب فروشگاه - از representative.ownerName یا fallback به representative.name */
  shopOwner: string | null;
  
  /** شناسه پنل - از representative.panelUsername یا representative.code */
  panelId: string;
  
  /** مبلغ فاکتور - فرمت شده با جداکننده هزار (e.g. "1,000,000") */
  amount: string;
  
  /** تاریخ صدور - از invoice.issueDate */
  issueDate: string;
  
  /** وضعیت فاکتور - فرمت شده با formatInvoiceStatus() */
  status: string;
  
  /** لینک پورتال - تولید شده با getPortalLink() */
  portalLink: string;
  
  /** آیا این ارسال مجدد است؟ - از invoice.sentToTelegram */
  isResend?: boolean;
  
  /** تعداد دفعات ارسال - از invoice.telegramSendCount */
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
    
    /**
     * Replace template variables with actual invoice data
     * 
     * Supported variables:
     * - {invoice_number}: شماره فاکتور
     * - {representative_name}: نام نماینده
     * - {shop_owner}: نام صاحب فروشگاه
     * - {panel_id}: شناسه پنل
     * - {amount}: مبلغ فاکتور (با جداکننده هزار)
     * - {issue_date}: تاریخ صدور
     * - {status}: وضعیت فاکتور
     * - {portal_link}: لینک پورتال
     * - {resend_indicator}: نشانگر ارسال مجدد
     */
    const templateVariables: Record<string, string> = {
      invoice_number: message.invoiceNumber,
      representative_name: message.representativeName,
      shop_owner: message.shopOwner || 'نامشخص',
      panel_id: message.panelId,
      amount: message.amount,
      issue_date: message.issueDate,
      status: message.status,
      portal_link: productionPortalLink,
      resend_indicator: resendIndicator
    };

    // Replace all variables in template
    let messageText = template;
    Object.entries(templateVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      messageText = messageText.replace(regex, value);
    });
    
    console.log('📝 Template variables replaced:', {
      invoice: message.invoiceNumber,
      variablesCount: Object.keys(templateVariables).length,
      messageLength: messageText.length
    });

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
    if (result.ok !== true) {
      console.error('❌ Telegram send failed:', {
        error_code: result.error_code,
        description: result.description,
        invoice: message.invoiceNumber
      });
      return false;
    }

    console.log(`✅ Telegram message sent successfully for invoice ${message.invoiceNumber}`);
    return true;
  } catch (error) {
    console.error('❌ خطا در ارسال پیام تلگرام:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      invoice: message.invoiceNumber,
      stack: error instanceof Error ? error.stack : undefined
    });
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

/**
 * Available template variables for Telegram messages
 */
export const TELEGRAM_TEMPLATE_VARIABLES = [
  'invoice_number',
  'representative_name',
  'shop_owner',
  'panel_id',
  'amount',
  'issue_date',
  'status',
  'portal_link',
  'resend_indicator'
] as const;

/**
 * Get default Telegram message template
 * Contains all standard variables for invoice notifications
 */
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

/**
 * Validate template and find used variables
 * Returns list of variables found in template
 */
export function validateTelegramTemplate(template: string): {
  isValid: boolean;
  usedVariables: string[];
  missingVariables: string[];
  invalidVariables: string[];
} {
  // Find all variables in template
  const variableRegex = /{([^}]+)}/g;
  const matches = template.matchAll(variableRegex);
  const usedVariables: string[] = [];
  const invalidVariables: string[] = [];
  
  for (const match of matches) {
    const variable = match[1];
    if (TELEGRAM_TEMPLATE_VARIABLES.includes(variable as any)) {
      if (!usedVariables.includes(variable)) {
        usedVariables.push(variable);
      }
    } else {
      if (!invalidVariables.includes(variable)) {
        invalidVariables.push(variable);
      }
    }
  }
  
  // Check for missing critical variables
  const criticalVariables = ['invoice_number', 'representative_name', 'amount'];
  const missingVariables = criticalVariables.filter(v => !usedVariables.includes(v));
  
  return {
    isValid: invalidVariables.length === 0 && missingVariables.length === 0,
    usedVariables,
    missingVariables,
    invalidVariables
  };
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
