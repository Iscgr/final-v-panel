-- Migration: Enhanced App Downloads with File Upload and View Statistics
-- Date: 2025-10-02
-- Description: افزودن قابلیت آپلود فایل QR Code و Video + آمار بازدید اپلیکیشن‌ها

-- گام 1: اضافه کردن فیلدهای جدید به جدول app_downloads
ALTER TABLE app_downloads 
  ADD COLUMN IF NOT EXISTS qr_code_file_path TEXT,
  ADD COLUMN IF NOT EXISTS video_file_path TEXT,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- گام 2: ایجاد جدول app_download_views برای ثبت آمار بازدید
CREATE TABLE IF NOT EXISTS app_download_views (
  id SERIAL PRIMARY KEY,
  app_download_id INTEGER NOT NULL REFERENCES app_downloads(id) ON DELETE CASCADE,
  representative_id INTEGER REFERENCES representatives(id),
  public_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  action_type TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMP DEFAULT NOW()
);

-- گام 3: ایجاد جدول uploaded_files برای مدیریت متادیتای فایل‌ها
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

-- گام 4: ایجاد ایندکس‌های بهینه‌ساز
CREATE INDEX IF NOT EXISTS idx_app_download_views_app_id ON app_download_views(app_download_id);
CREATE INDEX IF NOT EXISTS idx_app_download_views_created_at ON app_download_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_download_views_action_type ON app_download_views(action_type);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_entity ON uploaded_files(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_stored_name ON uploaded_files(stored_file_name);

-- گام 5: کامنت‌های توضیحی
COMMENT ON TABLE app_download_views IS 'آمار بازدید و دانلود اپلیکیشن‌ها در پرتال عمومی';
COMMENT ON TABLE uploaded_files IS 'متادیتای فایل‌های آپلود شده (QR Code و Video)';
COMMENT ON COLUMN app_downloads.qr_code_file_path IS 'مسیر فایل QR Code آپلود شده در سرور';
COMMENT ON COLUMN app_downloads.video_file_path IS 'مسیر فایل ویدئو آپلود شده در سرور';
COMMENT ON COLUMN app_downloads.view_count IS 'تعداد کل بازدید/دانلود (cached counter)';
COMMENT ON COLUMN app_download_views.action_type IS 'نوع عملیات: view, download, qr_scan';

-- گام 6: تابع برای به‌روزرسانی خودکار view_count
CREATE OR REPLACE FUNCTION update_app_download_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE app_downloads 
  SET view_count = view_count + 1,
      updated_at = NOW()
  WHERE id = NEW.app_download_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- گام 7: ایجاد Trigger برای به‌روزرسانی خودکار
DROP TRIGGER IF EXISTS trigger_update_view_count ON app_download_views;
CREATE TRIGGER trigger_update_view_count
  AFTER INSERT ON app_download_views
  FOR EACH ROW
  EXECUTE FUNCTION update_app_download_view_count();

-- گام 8: بروزرسانی view_count برای رکوردهای موجود (اگر داده قبلی وجود دارد)
UPDATE app_downloads 
SET view_count = COALESCE((
  SELECT COUNT(*) 
  FROM app_download_views 
  WHERE app_download_id = app_downloads.id
), 0)
WHERE view_count = 0 OR view_count IS NULL;
