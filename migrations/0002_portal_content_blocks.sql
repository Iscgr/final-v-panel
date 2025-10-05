CREATE TABLE IF NOT EXISTS "portal_content_blocks" (
    "id" serial PRIMARY KEY,
    "block_key" text NOT NULL UNIQUE,
    "title" text,
    "body" text NOT NULL DEFAULT '',
    "updated_by" text,
    "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE "portal_content_blocks" IS 'بلوک‌های متنی قابل ویرایش پرتال عمومی (فاز مقدماتی)';
--> statement-breakpoint
COMMENT ON COLUMN "portal_content_blocks"."block_key" IS 'شناسه منطقی بلوک (enum منطقی)';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portal_content_blocks_key" ON "portal_content_blocks" ("block_key");
--> statement-breakpoint
INSERT INTO "portal_content_blocks" ("block_key", "title", "body")
VALUES
    ('guidance', 'راهنمایی و توصیه‌ها', '• برای مشاهده جزئیات هر فاکتور از دکمه مربوط استفاده کنید.\n• اعلانات مهم در این بخش نمایش داده می‌شود.'),
    ('contact_info', 'اطلاعات تماس و پشتیبانی', 'تلفن: ۰۲۱-۱۲۳۴۵۶۷۸\nایمیل: support@example.com'),
    ('downloads_intro', '📱 دانلود اپلیکیشن‌های توصیه شده', 'برای استفاده بهینه از سرویس‌ها، اپلیکیشن‌های زیر را نصب کنید.'),
    ('support_hours', 'ساعات پاسخگویی', 'شنبه تا چهارشنبه، ۹ تا ۱۸'),
    ('announcements_title', 'عنوان بخش اعلانات', '📢 اعلانات و دانلودها')
ON CONFLICT ("block_key") DO NOTHING;
