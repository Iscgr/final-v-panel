/**
 * 🌱 Seed Script: Portal Customization Settings
 * 
 * این اسکریپت تنظیمات کاستومایزیشن پورتال عمومی را به دیتابیس اضافه می‌کند.
 * اگر تنظیمات قبلاً موجود باشند، به‌روزرسانی نمی‌شوند.
 */

import { db } from "../server/db.js";
import { settings } from "../shared/schema.js";
import { eq } from "drizzle-orm";

interface PortalSetting {
  key: string;
  value: string;
  description: string;
}

const portalSettings: PortalSetting[] = [
  {
    key: 'portal_header_message',
    value: 'برای دریافت جدیدترین نسخه نرم‌افزارهای توصیه شده، لطفاً به انتهای پورتال مراجعه فرمایید 📥',
    description: 'پیام اطلاع‌رسانی که در بالای پورتال نمایش داده می‌شود (جایگزین کد نماینده و شناسه پنل)'
  },
  {
    key: 'portal_downloads_intro',
    value: '📱 دانلود اپلیکیشن‌های توصیه شده\n\nبرای استفاده بهینه از سرویس‌ها، نصب نرم‌افزارهای زیر ضروری است:',
    description: 'متن معرفی بخش دانلود اپلیکیشن‌ها در پورتال'
  },
  {
    key: 'portal_guidance_text',
    value: `• برای مشاهده جزئیات هر فاکتور، روی دکمه "نمایش جزئیات" کلیک کنید.
• اعلانات مهم سیستم در بخش "اعلانات و دانلودها" نمایش داده می‌شود.
• برای دانلود اپلیکیشن‌های توصیه شده، از بخش دانلودها استفاده کنید.
• در صورت وجود هرگونه سوال یا مشکل، با پشتیبانی تماس بگیرید.`,
    description: 'متن راهنمایی و توصیه‌ها برای کاربران پورتال'
  },
  {
    key: 'portal_contact_phone',
    value: '۰۲۱-۱۲۳۴۵۶۷۸',
    description: 'شماره تماس پشتیبانی که در footer پورتال نمایش داده می‌شود'
  },
  {
    key: 'portal_contact_email',
    value: 'support@example.com',
    description: 'آدرس ایمیل پشتیبانی که در footer پورتال نمایش داده می‌شود'
  },
  {
    key: 'portal_support_hours',
    value: 'شنبه تا چهارشنبه، ۹ صبح تا ۶ عصر',
    description: 'ساعات کاری پشتیبانی که در footer پورتال نمایش داده می‌شود'
  },
  {
    key: 'portal_announcements_title',
    value: '📢 اعلانات و اطلاعیه‌ها',
    description: 'عنوان بخش اعلانات در پورتال'
  }
];

async function seedPortalSettings() {
  console.log('🌱 شروع seed تنظیمات پورتال...\n');

  let addedCount = 0;
  let skippedCount = 0;

  for (const setting of portalSettings) {
    try {
      // بررسی اینکه آیا تنظیمات قبلاً موجود است
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.key, setting.key))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  تنظیمات "${setting.key}" قبلاً موجود است - نادیده گرفته شد`);
        skippedCount++;
      } else {
        // اضافه کردن تنظیمات جدید
        await db.insert(settings).values({
          key: setting.key,
          value: setting.value,
          description: setting.description
        });
        console.log(`✅ تنظیمات "${setting.key}" با موفقیت اضافه شد`);
        addedCount++;
      }
    } catch (error) {
      console.error(`❌ خطا در اضافه کردن تنظیمات "${setting.key}":`, error);
    }
  }

  console.log('\n📊 خلاصه:');
  console.log(`   ✅ اضافه شده: ${addedCount}`);
  console.log(`   ⏭️  نادیده گرفته شده: ${skippedCount}`);
  console.log(`   📝 مجموع: ${portalSettings.length}`);

  console.log('\n🎉 seed تنظیمات پورتال با موفقیت تکمیل شد!\n');
}

// اجرای اسکریپت
seedPortalSettings()
  .then(() => {
    console.log('✨ اسکریپت با موفقیت اجرا شد');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 خطای کلی در اجرای اسکریپت:', error);
    process.exit(1);
  });
