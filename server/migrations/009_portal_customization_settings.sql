-- Migration: Portal Customization Settings
-- Description: اضافه کردن تنظیمات کاستومایزیشن کامل برای پورتال عمومی نمایندگان
-- Date: 2025-10-03

-- افزودن تنظیمات جدید پورتال به جدول settings (اگر قبلاً وجود ندارند)

-- 1. پیام هدر (جایگزین باکس‌های code و panelUsername)
INSERT INTO settings (key, value, description)
VALUES (
  'portal_header_message',
  'برای دریافت جدیدترین نسخه نرم‌افزارهای توصیه شده، لطفاً به انتهای پورتال مراجعه فرمایید 📥',
  'پیام اطلاع‌رسانی که در بالای پورتال نمایش داده می‌شود (جایگزین کد نماینده و شناسه پنل)'
)
ON CONFLICT (key) DO NOTHING;

-- 2. متن معرفی بخش دانلودها
INSERT INTO settings (key, value, description)
VALUES (
  'portal_downloads_intro',
  '📱 دانلود اپلیکیشن‌های توصیه شده

برای استفاده بهینه از سرویس‌ها، نصب نرم‌افزارهای زیر ضروری است:',
  'متن معرفی بخش دانلود اپلیکیشن‌ها در پورتال'
)
ON CONFLICT (key) DO NOTHING;

-- 3. متن راهنمایی و توصیه‌ها
INSERT INTO settings (key, value, description)
VALUES (
  'portal_guidance_text',
  '• برای مشاهده جزئیات هر فاکتور، روی دکمه "نمایش جزئیات" کلیک کنید.
• اعلانات مهم سیستم در بخش "اعلانات و دانلودها" نمایش داده می‌شود.
• برای دانلود اپلیکیشن‌های توصیه شده، از بخش دانلودها استفاده کنید.
• در صورت وجود هرگونه سوال یا مشکل، با پشتیبانی تماس بگیرید.',
  'متن راهنمایی و توصیه‌ها برای کاربران پورتال'
)
ON CONFLICT (key) DO NOTHING;

-- 4. شماره تماس پشتیبانی
INSERT INTO settings (key, value, description)
VALUES (
  'portal_contact_phone',
  '۰۲۱-۱۲۳۴۵۶۷۸',
  'شماره تماس پشتیبانی که در footer پورتال نمایش داده می‌شود'
)
ON CONFLICT (key) DO NOTHING;

-- 5. ایمیل پشتیبانی
INSERT INTO settings (key, value, description)
VALUES (
  'portal_contact_email',
  'support@example.com',
  'آدرس ایمیل پشتیبانی که در footer پورتال نمایش داده می‌شود'
)
ON CONFLICT (key) DO NOTHING;

-- 6. ساعات پشتیبانی
INSERT INTO settings (key, value, description)
VALUES (
  'portal_support_hours',
  'شنبه تا چهارشنبه، ۹ صبح تا ۶ عصر',
  'ساعات کاری پشتیبانی که در footer پورتال نمایش داده می‌شود'
)
ON CONFLICT (key) DO NOTHING;

-- 7. عنوان بخش اعلانات (اختیاری)
INSERT INTO settings (key, value, description)
VALUES (
  'portal_announcements_title',
  '📢 اعلانات و اطلاعیه‌ها',
  'عنوان بخش اعلانات در پورتال'
)
ON CONFLICT (key) DO NOTHING;

-- بروزرسانی timestamp
UPDATE settings 
SET updated_at = NOW() 
WHERE key IN (
  'portal_header_message',
  'portal_downloads_intro',
  'portal_guidance_text',
  'portal_contact_phone',
  'portal_contact_email',
  'portal_support_hours',
  'portal_announcements_title'
);
