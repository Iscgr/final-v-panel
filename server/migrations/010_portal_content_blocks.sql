-- Migration: 010_portal_content_blocks.sql
-- ایجاد جدول برای بلوک‌های محتوایی پرتال (فاز 1 - هنوز مصرف مستقیم در فرانت ندارد)
-- Safe / additive only

CREATE TABLE IF NOT EXISTS portal_content_blocks (
  id SERIAL PRIMARY KEY,
  block_key TEXT UNIQUE NOT NULL, -- مانند: guidance, contact_info, downloads_intro, support_hours, announcements_title
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE portal_content_blocks IS 'بلوک‌های متنی قابل ویرایش پرتال عمومی (فاز مقدماتی)';
COMMENT ON COLUMN portal_content_blocks.block_key IS 'شناسه منطقی بلوک (enum منطقی)';

-- ایندکس برای جستجوی سریع بر اساس block_key
CREATE INDEX IF NOT EXISTS idx_portal_content_blocks_key ON portal_content_blocks(block_key);

-- Seed اولیه فقط اگر خالی است
INSERT INTO portal_content_blocks (block_key, title, body)
SELECT seed.block_key, seed.title, seed.body
FROM (
  VALUES
    ('guidance','راهنمایی و توصیه‌ها', '• برای مشاهده جزئیات هر فاکتور از دکمه مربوط استفاده کنید.\n• اعلانات مهم در این بخش نمایش داده می‌شود.'),
    ('contact_info','اطلاعات تماس و پشتیبانی', 'تلفن: ۰۲۱-۱۲۳۴۵۶۷۸\nایمیل: support@example.com'),
    ('downloads_intro','📱 دانلود اپلیکیشن‌های توصیه شده', 'برای استفاده بهینه از سرویس‌ها، اپلیکیشن‌های زیر را نصب کنید.'),
    ('support_hours','ساعات پاسخگویی', 'شنبه تا چهارشنبه، ۹ تا ۱۸'),
    ('announcements_title','عنوان بخش اعلانات', '📢 اعلانات و دانلودها')
) AS seed(block_key, title, body)
LEFT JOIN portal_content_blocks pcb ON pcb.block_key = seed.block_key
WHERE pcb.block_key IS NULL;
