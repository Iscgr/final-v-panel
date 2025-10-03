-- Migration: 010 - Resources File Storage and Statistics
-- تاریخ: 2025-10-02
-- هدف: افزودن قابلیت آپلود فایل، آمار بازدید و مدیریت فایل‌های آپلود شده

-- 1. اضافه کردن فیلدهای جدید به جدول app_downloads
ALTER TABLE app_downloads 
ADD COLUMN IF NOT EXISTS qr_code_file_path TEXT,
ADD COLUMN IF NOT EXISTS video_file_path TEXT,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- 2. ایجاد جدول app_download_views برای ثبت آمار بازدید
CREATE TABLE IF NOT EXISTS app_download_views (
  id SERIAL PRIMARY KEY,
  app_download_id INTEGER NOT NULL REFERENCES app_downloads(id) ON DELETE CASCADE,
  representative_id INTEGER REFERENCES representatives(id) ON DELETE SET NULL,
  public_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  action_type TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. ایجاد جدول uploaded_files برای مدیریت فایل‌های آپلود شده
CREATE TABLE IF NOT EXISTS uploaded_files (
  id SERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  stored_file_name TEXT NOT NULL UNIQUE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. ایجاد ایندکس‌ها برای بهبود performance
CREATE INDEX IF NOT EXISTS idx_app_download_views_app_id ON app_download_views(app_download_id);
CREATE INDEX IF NOT EXISTS idx_app_download_views_rep_id ON app_download_views(representative_id);
CREATE INDEX IF NOT EXISTS idx_app_download_views_public_id ON app_download_views(public_id);
CREATE INDEX IF NOT EXISTS idx_app_download_views_created_at ON app_download_views(created_at);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_entity ON uploaded_files(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_stored_name ON uploaded_files(stored_file_name);

-- 5. اضافه کردن Comment‌ها برای مستندسازی
COMMENT ON TABLE app_download_views IS 'ثبت تاریخچه بازدید و کلیک‌های اپلیکیشن‌ها برای آمارگیری';
COMMENT ON TABLE uploaded_files IS 'متادیتای فایل‌های آپلود شده (QR Code و Video)';
COMMENT ON COLUMN app_downloads.qr_code_file_path IS 'مسیر فایل QR Code آپلود شده در سرور';
COMMENT ON COLUMN app_downloads.video_file_path IS 'مسیر فایل ویدئو آپلود شده در سرور';
COMMENT ON COLUMN app_downloads.view_count IS 'شمارنده کلی بازدید (cached counter)';

-- Success message
SELECT '✅ Migration 010 completed: Resources File Storage and Statistics' AS status;
