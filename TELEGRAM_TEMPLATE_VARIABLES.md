# 📋 مستندات متغیرهای قالب پیام تلگرام

> **نسخه:** ODIN v5.0  
> **تاریخ:** 1404/07/11  
> **وضعیت:** ✅ تایید شده و تست شده

## 📖 مقدمه

این سند شامل اطلاعات کامل درباره متغیرهای قابل استفاده در قالب پیام تلگرام و منبع داده هر یک از آن‌ها است.

---

## 🎯 متغیرهای قابل استفاده

### 1. `{invoice_number}` - شماره فاکتور
- **نوع:** متغیر اجباری ⚠️
- **منبع داده:** `invoices.invoice_number`
- **جدول:** `invoices`
- **نمونه:** `INV-923751001`
- **توضیحات:** شماره یکتای فاکتور که به صورت خودکار تولید می‌شود

---

### 2. `{representative_name}` - نام نماینده
- **نوع:** متغیر اجباری ⚠️
- **منبع داده:** `representatives.name`
- **جدول:** `representatives`
- **نمونه:** `فروشگاه Abedmb`
- **توضیحات:** نام کامل نماینده یا فروشگاه

---

### 3. `{shop_owner}` - نام صاحب فروشگاه
- **نوع:** اختیاری
- **منبع داده:** `representatives.owner_name` با fallback به `representatives.name`
- **جدول:** `representatives`
- **نمونه:** `محمد رضایی`
- **توضیحات:** اگر نام صاحب فروشگاه ثبت نشده باشد، از نام نماینده استفاده می‌شود

**الگوریتم:**
```typescript
shopOwner = representative.ownerName || representative.name;
```

---

### 4. `{panel_id}` - شناسه پنل نماینده
- **نوع:** اختیاری
- **منبع داده:** `representatives.panel_username` با fallback به `representatives.code`
- **جدول:** `representatives`
- **نمونه:** `Abedmb` یا `REP-001`
- **توضیحات:** نام کاربری پنل نماینده یا کد منحصر به فرد او

**الگوریتم:**
```typescript
panelId = representative.panelUsername || representative.code;
```

---

### 5. `{amount}` - مبلغ فاکتور
- **نوع:** متغیر اجباری ⚠️
- **منبع داده:** `invoices.amount`
- **جدول:** `invoices`
- **فرمت:** با جداکننده هزار فارسی
- **نمونه:** `۵۱۲,۰۰۰`
- **توضیحات:** مبلغ فاکتور به تومان با فرمت خوانا

**الگوریتم:**
```typescript
amount = parseFloat(invoice.amount).toLocaleString('fa-IR', {
  maximumFractionDigits: 0
});
```

---

### 6. `{issue_date}` - تاریخ صدور فاکتور
- **نوع:** اختیاری
- **منبع داده:** `invoices.issue_date`
- **جدول:** `invoices`
- **فرمت:** تاریخ شمسی
- **نمونه:** `۱۴۰۴/۷/۱۰`
- **توضیحات:** تاریخ صدور فاکتور به شمسی

---

### 7. `{status}` - وضعیت فاکتور
- **نوع:** اختیاری
- **منبع داده:** `invoices.status`
- **جدول:** `invoices`
- **مقادیر ممکن:**
  - `پرداخت شده ✅` - برای `status = 'paid'`
  - `پرداخت نشده ❌` - برای `status = 'unpaid'`
- **نمونه:** `پرداخت نشده ❌`
- **توضیحات:** وضعیت پرداخت فاکتور

**الگوریتم:**
```typescript
status = invoice.status === 'paid' ? 'پرداخت شده ✅' : 'پرداخت نشده ❌';
```

---

### 8. `{portal_link}` - لینک پورتال نماینده
- **نوع:** اختیاری
- **منبع داده:** تولید شده از `representatives.public_id`
- **جدول:** `representatives`
- **نمونه:** `https://example.com/portal/6Bpx26e9whzrWaOYdjlb7CpzFQnkEThh`
- **توضیحات:** لینک دسترسی نماینده به پورتال شخصی

**الگوریتم:**
```typescript
import { getPortalLink } from './config.js';
portalLink = getPortalLink(representative.publicId);

// Function implementation:
function getPortalLink(publicId: string): string {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  return `${baseUrl}/portal/${publicId}`;
}
```

**نکته:** سیستم به صورت خودکار در production از دامنه واقعی استفاده می‌کند.

---

### 9. `{resend_indicator}` - نشانگر ارسال مجدد
- **نوع:** خودکار (نباید دستی استفاده شود)
- **منبع داده:** `invoices.sent_to_telegram` و `invoices.telegram_send_count`
- **جدول:** `invoices`
- **مقادیر ممکن:**
  - خالی - اگر اولین ارسال باشد
  - ` (ارسال مجدد - 2)` - اگر بار دوم باشد
  - ` (ارسال مجدد - 3)` - اگر بار سوم باشد
- **نمونه:** ` (ارسال مجدد - 3)`

**الگوریتم:**
```typescript
const resendIndicator = invoice.sentToTelegram 
  ? ` (ارسال مجدد - ${(invoice.telegramSendCount || 0) + 1})` 
  : '';
```

---

## 📊 جدول خلاصه منابع داده

| متغیر | جدول | ستون | اجباری | Fallback |
|------|------|------|--------|----------|
| `{invoice_number}` | `invoices` | `invoice_number` | ✅ | - |
| `{representative_name}` | `representatives` | `name` | ✅ | - |
| `{shop_owner}` | `representatives` | `owner_name` | ❌ | `name` |
| `{panel_id}` | `representatives` | `panel_username` | ❌ | `code` |
| `{amount}` | `invoices` | `amount` | ✅ | - |
| `{issue_date}` | `invoices` | `issue_date` | ❌ | - |
| `{status}` | `invoices` | `status` | ❌ | - |
| `{portal_link}` | `representatives` | `public_id` | ❌ | - |
| `{resend_indicator}` | `invoices` | `sent_to_telegram`, `telegram_send_count` | ❌ (خودکار) | خالی |

---

## 🔗 روابط بین جداول

```
invoices
├─ invoice_number        → {invoice_number}
├─ amount                → {amount}
├─ issue_date            → {issue_date}
├─ status                → {status}
├─ sent_to_telegram      → {resend_indicator}
├─ telegram_send_count   → {resend_indicator}
└─ representative_id     → JOIN به جدول representatives

representatives
├─ name                  → {representative_name}
├─ owner_name            → {shop_owner}
├─ panel_username        → {panel_id}
├─ code                  → {panel_id} (fallback)
└─ public_id             → {portal_link}
```

---

## ✅ قالب پیشفرض (Default Template)

```
📋 فاکتور شماره {invoice_number}{resend_indicator}

🏪 نماینده: {representative_name}
👤 صاحب فروشگاه: {shop_owner}
📱 شناسه پنل: {panel_id}
💰 مبلغ فاکتور: {amount} تومان
📅 تاریخ صدور: {issue_date}
🔍 وضعیت: {status}

ℹ️ برای مشاهده جزئیات کامل فاکتور، وارد لینک زیر بشوید

{portal_link}

تولید شده توسط سیستم مدیریت مالی 🤖
```

---

## 🔍 نمونه خروجی پیام

```
📋 فاکتور شماره INV-923751001 (ارسال مجدد - 3)

🏪 نماینده: فروشگاه Abedmb
👤 صاحب فروشگاه: فروشگاه Abedmb
📱 شناسه پنل: Abedmb
💰 مبلغ فاکتور: ۵۱۲,۰۰۰ تومان
📅 تاریخ صدور: ۱۴۰۴/۷/۱۰
🔍 وضعیت: پرداخت نشده ❌

ℹ️ برای مشاهده جزئیات کامل فاکتور، وارد لینک زیر بشوید

https://example.com/portal/6Bpx26e9whzrWaOYdjlb7CpzFQnkEThh

تولید شده توسط سیستم مدیریت مالی 🤖
```

---

## 🧪 Validation API

برای اعتبارسنجی قالب پیام، از endpoint زیر استفاده کنید:

```http
POST /api/settings/telegram/validate-template
Content-Type: application/json

{
  "template": "قالب پیام شما..."
}
```

**پاسخ موفق:**
```json
{
  "success": true,
  "validation": {
    "isValid": true,
    "usedVariables": ["invoice_number", "representative_name", "amount", ...],
    "missingVariables": [],
    "invalidVariables": []
  }
}
```

**پاسخ ناموفق:**
```json
{
  "success": true,
  "validation": {
    "isValid": false,
    "usedVariables": ["invoice_number"],
    "missingVariables": ["representative_name", "amount"],
    "invalidVariables": ["invalid_var"]
  }
}
```

---

## 📝 نکات مهم

1. **متغیرهای اجباری:** حداقل باید از `{invoice_number}`, `{representative_name}` و `{amount}` استفاده شود
2. **Case Sensitive:** نام متغیرها به حروف کوچک و بزرگ حساس هستند
3. **Fallback Values:** برخی متغیرها دارای مقدار پیشفرض هستند (مثل `{shop_owner}`)
4. **Auto Variables:** متغیر `{resend_indicator}` خودکار است و نیازی به تنظیم دستی ندارد

---

## 🔧 تست سیستم

برای تست کامل سیستم از اسکریپت زیر استفاده کنید:

```bash
# تست validation
npx tsx scripts/test-telegram-template-validation.ts

# تست ارسال واقعی
npx tsx scripts/test-telegram-real-invoice.ts
```

---

**آخرین بروزرسانی:** 1404/07/11  
**وضعیت:** ✅ تست شده و تایید شده  
**نسخه:** ODIN v5.0
